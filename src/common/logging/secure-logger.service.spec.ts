import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecureLogger } from './secure-logger.service';

describe('SecureLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not serialize Nest context strings as character-indexed fields', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new SecureLogger().log('Nest started', 'NestFactory');
    const record = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(record.message).toBe('Nest started');
    expect(record['0']).toBeUndefined();
  });

  it('redacts sensitive field names and does not expand nested objects', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    new SecureLogger().log('login event', {
      refreshToken: 'must-not-appear',
      userId: 8,
      nested: { password: 'also-secret' },
    } as never);
    const serialized = String(write.mock.calls[0]?.[0]);
    expect(serialized).toContain('"userId":8');
    expect(serialized).not.toContain('must-not-appear');
    expect(serialized).not.toContain('also-secret');
  });
});
