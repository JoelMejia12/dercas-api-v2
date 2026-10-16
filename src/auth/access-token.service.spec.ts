import { afterEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { AccessTokenService } from './access-token.service';

const previousSecret = process.env.AUTH_TOKEN_SECRET;
afterEach(() => { if (previousSecret === undefined) delete process.env.AUTH_TOKEN_SECRET; else process.env.AUTH_TOKEN_SECRET = previousSecret; });

describe('AccessTokenService', () => {
  it('signs short lived claims and rejects expiration and tampering', () => {
    process.env.AUTH_TOKEN_SECRET = 'a'.repeat(40);
    const service = new AccessTokenService();
    const token = service.issue('2', '3', '4', 1_000_000);
    const [header, payload, signature] = token.split('.');
    const tampered = `${header}.${payload}.${signature![0] === 'a' ? 'b' : 'a'}${signature!.slice(1)}`;
    expect(service.verify(token, 1_000_001)).toMatchObject({ sub: '2', sid: '3', did: '4' });
    expect(() => service.verify(token, 1_901_000)).toThrow();
    expect(() => service.verify(tampered, 1_000_001)).toThrow();
  });

  it('issues distinct access tokens when refreshed within the same second', () => {
    process.env.AUTH_TOKEN_SECRET = 'a'.repeat(40);
    const service = new AccessTokenService();
    const first = service.issue('2', '3', '4', 1_000_000);
    const second = service.issue('2', '3', '4', 1_000_000);

    expect(second).not.toBe(first);
    expect(service.verify(first, 1_000_001).jti).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(service.verify(second, 1_000_001).jti).not.toBe(service.verify(first, 1_000_001).jti);
  });

  it('continues to accept unexpired tokens issued before the jti claim was added', () => {
    process.env.AUTH_TOKEN_SECRET = 'a'.repeat(40);
    const service = new AccessTokenService();
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
      sub: '2', sid: '3', did: '4', iat: 1_000, exp: 1_900, iss: 'dercas-api', aud: 'dercas-client',
    })}`;
    const signature = createHmac('sha256', process.env.AUTH_TOKEN_SECRET!).update(content).digest('base64url');

    expect(service.verify(`${content}.${signature}`, 1_001_000)).toMatchObject({ sub: '2', sid: '3', did: '4' });
  });

  it('fails closed when no sufficiently strong server secret is configured', () => {
    delete process.env.AUTH_TOKEN_SECRET;
    expect(() => new AccessTokenService().issue('1', '2', '3')).toThrow('Authentication is not configured');
  });
});
