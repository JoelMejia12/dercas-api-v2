import { describe, expect, it } from 'vitest';
import { OpaqueTokenService } from './opaque-token.service';

describe('OpaqueTokenService', () => {
  it('issues a high-entropy token and verifies its stored hash', () => {
    const service = new OpaqueTokenService();
    const issued = service.issue();
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issued.token).not.toBe(issued.tokenHash);
    expect(service.verify(issued.token, issued.tokenHash)).toBe(true);
    expect(service.verify('wrong-token', issued.tokenHash)).toBe(false);
    expect(service.verify(issued.token, 'not-a-hash')).toBe(false);
  });
});
