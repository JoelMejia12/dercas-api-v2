import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ISSUER = 'dercas-api';
const AUDIENCE = 'dercas-client';
const ACCESS_TTL_SECONDS = 900;
interface TokenClaims { sub: string; sid: string; did: string; iat: number; exp: number; iss: string; aud: string; jti?: string }

@Injectable()
export class AccessTokenService {
  issue(userId: string, sessionId: string, deviceId: string, now = Date.now()): string {
    const iat = Math.floor(now / 1000);
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode({ sub: userId, sid: sessionId, did: deviceId, iat, exp: iat + ACCESS_TTL_SECONDS,
      iss: ISSUER, aud: AUDIENCE, jti: randomBytes(16).toString('base64url') });
    const content = `${header}.${payload}`;
    return `${content}.${this.sign(content).toString('base64url')}`;
  }

  assertConfigured(): void {
    const secret = process.env.AUTH_TOKEN_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) throw new ServiceUnavailableException('Authentication is not configured');
  }

  verify(token: string, now = Date.now()): TokenClaims {
    if (token.length > 4096) throw new UnauthorizedException();
    const parts = token.split('.');
    if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new UnauthorizedException();
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
    let header: unknown;
    let claims: unknown;
    try {
      header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    } catch { throw new UnauthorizedException(); }
    if (!header || typeof header !== 'object' || (header as { alg?: unknown }).alg !== 'HS256' || (header as { typ?: unknown }).typ !== 'JWT') throw new UnauthorizedException();
    const expected = this.sign(`${headerPart}.${payloadPart}`);
    const provided = Buffer.from(signaturePart, 'base64url');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new UnauthorizedException();
    const c = claims as Partial<TokenClaims>;
    const nowSeconds = Math.floor(now / 1000);
    if (typeof c.sub !== 'string' || typeof c.sid !== 'string' || typeof c.did !== 'string'
      || !/^\d+$/.test(c.sub) || !/^\d+$/.test(c.sid) || !/^\d+$/.test(c.did)
      || !Number.isInteger(c.iat) || !Number.isInteger(c.exp) || c.iss !== ISSUER || c.aud !== AUDIENCE
      || (c.jti !== undefined && (typeof c.jti !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(c.jti)))
      || c.iat! > nowSeconds || c.exp! <= nowSeconds || c.exp! - c.iat! > ACCESS_TTL_SECONDS) throw new UnauthorizedException();
    return c as TokenClaims;
  }

  private sign(content: string): Buffer {
    this.assertConfigured();
    const secret = process.env.AUTH_TOKEN_SECRET;
    // assertConfigured above guarantees this value is present.
    if (!secret) throw new ServiceUnavailableException('Authentication is not configured');
    return createHmac('sha256', secret).update(content).digest();
  }

  private encode(value: object): string { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
}
