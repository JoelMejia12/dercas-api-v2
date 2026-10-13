import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password-hasher.service';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with Argon2id and verifies the original password', async () => {
    const hash = await hasher.hash('a-long-test-password');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify('a-long-test-password', hash)).resolves.toBe(true);
    await expect(hasher.verify('a-different-password', hash)).resolves.toBe(false);
  });

  it('rejects empty and unreasonably large password inputs', async () => {
    await expect(hasher.hash('')).rejects.toThrow('non-empty');
    await expect(hasher.hash('x'.repeat(1025))).rejects.toThrow('supported input size');
  });
});
