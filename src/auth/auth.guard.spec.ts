import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('rejects missing or invalid access tokens', async () => {
    const guard = new AuthGuard({ verify: vi.fn(() => { throw new UnauthorizedException(); }) } as never, { findActivePrincipal: vi.fn() } as never);
    const context = (authorization?: string) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }) });
    await expect(guard.canActivate(context() as never)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context('Bearer forged') as never)).rejects.toThrow(UnauthorizedException);
  });

  it('requires an open server-side session and loads grants from the database', async () => {
    const verify = vi.fn().mockReturnValue({ sub: '2', sid: '3', did: '4' });
    const findActivePrincipal = vi.fn().mockResolvedValue(['gps.read']);
    const request = { headers: { authorization: 'Bearer signed' }, userId: '999', role: 'ADMINISTRADOR' };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };
    const guard = new AuthGuard({ verify } as never, { findActivePrincipal } as never);
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(findActivePrincipal).toHaveBeenCalledWith('2', '3', '4');
    expect(request).toMatchObject({ authPrincipal: { userId: '2', sessionId: '3', deviceId: '4', permissions: ['gps.read'] } });

    findActivePrincipal.mockResolvedValue(undefined);
    const revoked = new AuthGuard({ verify } as never, { findActivePrincipal } as never);
    await expect(revoked.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });
});
