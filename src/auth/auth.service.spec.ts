import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { AuthIdentityChangedError } from './auth.repository';

function setup(active = true, validPassword = true, validDevice = true) {
  const repository = {
    findUser: vi.fn().mockResolvedValue({ id: '5', correo: 'person@example.test', password_hash: 'argon-hash', activo: active }),
    findDevice: vi.fn().mockResolvedValue({ id: '9', device_token_hash: 'device-hash', activo: validDevice }),
    createSession: vi.fn().mockResolvedValue({ id: '14' }),
    findRefreshSession: vi.fn(), rotateRefresh: vi.fn(), revoke: vi.fn(), closeSession: vi.fn(), findActivePrincipal: vi.fn(),
  };
  const passwords = { verify: vi.fn().mockResolvedValue(validPassword), hash: vi.fn().mockResolvedValue('dummy-password-hash') };
  const opaque = { verify: vi.fn().mockReturnValue(validDevice), issue: vi.fn().mockReturnValue({ token: 'raw-refresh-secret', tokenHash: 'hashed-refresh-secret' }), hash: vi.fn().mockReturnValue('old-hash') };
  const access = { assertConfigured: vi.fn(), issue: vi.fn().mockReturnValue('signed-access-token') };
  return { service: new AuthService(repository as never, passwords as never, opaque as never, access as never), repository, passwords, opaque, access };
}

describe('AuthService', () => {
  it('rejects invalid credentials and inactive users without a differentiated response', async () => {
    const invalid = setup(true, false);
    await expect(invalid.service.login('person@example.test', 'wrong', '9', 'bad-device')).rejects.toThrow('Invalid credentials');
    const inactive = setup(false, true);
    await expect(inactive.service.login('person@example.test', 'correct', '9', 'valid-device')).rejects.toThrow('Invalid credentials');
    expect(inactive.repository.createSession).not.toHaveBeenCalled();
  });

  it('verifies a dummy Argon2id hash for unknown accounts to reduce login timing enumeration', async () => {
    const { service, repository, passwords } = setup();
    repository.findUser.mockResolvedValue(undefined);
    await expect(service.login('unknown@example.test', 'wrong', '9', 'valid-device')).rejects.toThrow('Invalid credentials');
    expect(passwords.hash).toHaveBeenCalledTimes(1);
    expect(passwords.verify).toHaveBeenCalledWith('wrong', 'dummy-password-hash');
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('creates a device-bound session storing only refresh hash and returns tokens once', async () => {
    const { service, repository } = setup();
    const result = await service.login('person@example.test', 'correct', '9', 'valid-device', '192.0.2.1');
    expect(repository.createSession).toHaveBeenCalledWith('5', '9', 'hashed-refresh-secret', '192.0.2.1', 'argon-hash', 'device-hash');
    expect(repository.createSession.mock.calls.flat().join('|')).not.toContain('raw-refresh-secret');
    expect(result).toMatchObject({ accessToken: 'signed-access-token', refreshToken: 'raw-refresh-secret', sessionId: '14' });
  });

  it('rotates refresh tokens and rejects expiry or a competing replay', async () => {
    const { service, repository } = setup();
    repository.findRefreshSession.mockResolvedValue({ id: '14', usuario_id: '5', dispositivo_id: '9' });
    repository.rotateRefresh.mockResolvedValue(false);
    await expect(service.refresh('14', 'old-token')).rejects.toThrow();
    expect(repository.rotateRefresh).toHaveBeenCalledWith('14', 'old-hash', 'hashed-refresh-secret', 2_592_000);
    repository.findRefreshSession.mockResolvedValue(undefined);
    await expect(service.refresh('14', 'expired-token')).rejects.toThrow();
  });

  it('allows only one simulated concurrent refresh to consume the previous hash', async () => {
    const { service, repository, access } = setup();
    repository.findRefreshSession.mockResolvedValue({ id: '14', usuario_id: '5', dispositivo_id: '9' });
    let currentHash = 'old-hash';
    repository.rotateRefresh.mockImplementation(async (_sessionId: string, previousHash: string, nextHash: string) => {
      if (previousHash !== currentHash) return false;
      currentHash = nextHash;
      return true;
    });

    const results = await Promise.allSettled([
      service.refresh('14', 'presented-token'),
      service.refresh('14', 'presented-token'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(access.issue).toHaveBeenCalledTimes(1);
  });

  it('does not issue tokens when session persistence or refresh rotation fails', async () => {
    const login = setup();
    login.repository.createSession.mockRejectedValue(new Error('database unavailable'));
    await expect(login.service.login('person@example.test', 'correct', '9', 'valid-device')).rejects.toThrow('database unavailable');
    expect(login.access.issue).not.toHaveBeenCalled();

    const refresh = setup();
    refresh.repository.findRefreshSession.mockResolvedValue({ id: '14', usuario_id: '5', dispositivo_id: '9' });
    refresh.repository.rotateRefresh.mockRejectedValue(new Error('database unavailable'));
    await expect(refresh.service.refresh('14', 'presented-token')).rejects.toThrow('database unavailable');
    expect(refresh.access.issue).not.toHaveBeenCalled();
  });

  it('rejects login when the account or device changed after credential verification', async () => {
    const { service, repository, access } = setup();
    repository.createSession.mockRejectedValue(new AuthIdentityChangedError());
    await expect(service.login('person@example.test', 'correct', '9', 'valid-device')).rejects.toThrow('Invalid credentials');
    expect(access.issue).not.toHaveBeenCalled();
  });

  it('does not let unauthenticated callers choose a user for revocation', async () => {
    const { service, repository } = setup();
    await service.revoke('14', '5', '192.0.2.1');
    expect(repository.revoke).toHaveBeenCalledWith('14', '5', '192.0.2.1');
  });

  it('closes the current session for logout', async () => {
    const { service, repository } = setup();
    await service.logout('14', '5', '192.0.2.1');
    expect(repository.closeSession).toHaveBeenCalledWith('14', '5', '192.0.2.1');
  });

  it('fails before creating or rotating a session when token signing is not configured', async () => {
    const { service, repository, access } = setup();
    access.assertConfigured.mockImplementation(() => { throw new Error('not configured'); });
    await expect(service.login('person@example.test', 'correct', '9', 'valid-device')).rejects.toThrow('not configured');
    await expect(service.refresh('14', 'old-token')).rejects.toThrow('not configured');
    expect(repository.findUser).not.toHaveBeenCalled();
    expect(repository.createSession).not.toHaveBeenCalled();
    expect(repository.findRefreshSession).not.toHaveBeenCalled();
    expect(repository.rotateRefresh).not.toHaveBeenCalled();
  });
});
