import { afterEach, describe, expect, it } from 'vitest';
import { AccessTokenService } from './access-token.service';

const previousSecret = process.env.AUTH_TOKEN_SECRET;
afterEach(() => { if (previousSecret === undefined) delete process.env.AUTH_TOKEN_SECRET; else process.env.AUTH_TOKEN_SECRET = previousSecret; });

describe('AccessTokenService', () => {
  it('signs short lived claims and rejects expiration and tampering', () => {
    process.env.AUTH_TOKEN_SECRET = 'a'.repeat(40);
    const service = new AccessTokenService();
    const token = service.issue('2', '3', '4', 1_000_000);
    expect(service.verify(token, 1_000_001)).toMatchObject({ sub: '2', sid: '3', did: '4' });
    expect(() => service.verify(token, 1_901_000)).toThrow();
    expect(() => service.verify(`${token.slice(0, -1)}x`, 1_000_001)).toThrow();
  });

  it('fails closed when no sufficiently strong server secret is configured', () => {
    delete process.env.AUTH_TOKEN_SECRET;
    expect(() => new AccessTokenService().issue('1', '2', '3')).toThrow('Authentication is not configured');
  });
});
