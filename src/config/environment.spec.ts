import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment';

const TEST_AUTH_TOKEN_SECRET = 'unit-test-only-secret-with-at-least-32-bytes';
const configured = (values: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  AUTH_TOKEN_SECRET: TEST_AUTH_TOKEN_SECRET,
  NODE_ENV: 'test',
  ...values,
});

describe('validateEnvironment', () => {
  it('uses safe defaults and allows database settings to be supplied later with a valid test secret', () => {
    expect(validateEnvironment(configured())).toEqual({
      port: 3000,
      nodeEnv: 'test',
      logLevel: 'info',
      database: { sslMode: 'disable' },
    });
  });

  it('requires AUTH_TOKEN_SECRET at startup and validates at least 32 UTF-8 bytes without echoing it', () => {
    expect(() => validateEnvironment({})).toThrow(
      'AUTH_TOKEN_SECRET must be at least 32 bytes',
    );
    const shortSecret = 'sensitive-short-test-secret';
    expect(() => validateEnvironment(configured({ AUTH_TOKEN_SECRET: shortSecret }))).toThrow(
      'AUTH_TOKEN_SECRET must be at least 32 bytes',
    );
    expect(() => validateEnvironment(configured({ AUTH_TOKEN_SECRET: shortSecret }))).not.toThrow(shortSecret);
    expect(validateEnvironment(configured({ AUTH_TOKEN_SECRET: 'é'.repeat(16) })).nodeEnv).toBe('test');
  });

  it('treats blank placeholders in the example environment file as unconfigured', () => {
    expect(validateEnvironment(configured({
      DATABASE_URL: '', PGHOST: '', PGPORT: '', PGDATABASE: '', PGUSER: '', PGPASSWORD: '', PGSSL: 'disable',
    })).database).toEqual({ sslMode: 'disable' });
  });

  it('rejects partial PostgreSQL configuration without echoing supplied credentials', () => {
    expect(() => validateEnvironment(configured({ PGHOST: 'db.internal', PGPASSWORD: 'secret-value' }))).toThrow(
      'PGHOST, PGDATABASE, PGUSER, and PGPASSWORD are required together',
    );
    expect(() => validateEnvironment(configured({ PGHOST: 'db.internal', PGPASSWORD: 'secret-value' }))).not.toThrow(
      'secret-value',
    );
    expect(() => validateEnvironment(configured({ PGUSER: 'sensitive-user' }))).toThrow(
      'PGHOST, PGDATABASE, PGUSER, and PGPASSWORD are required together',
    );
    expect(() => validateEnvironment(configured({ PGUSER: 'sensitive-user' }))).not.toThrow('sensitive-user');
  });

  it('requires a valid PostgreSQL URL when DATABASE_URL is used', () => {
    expect(() => validateEnvironment(configured({ DATABASE_URL: 'https://example.test' }))).toThrow(
      'DATABASE_URL must be a valid PostgreSQL URL',
    );
    expect(() => validateEnvironment(configured({ DATABASE_URL: 'postgres://user:pass@host/db?sslmode=require' })))
      .toThrow('DATABASE_URL must be a valid PostgreSQL URL');
    expect(() => validateEnvironment(configured({ DATABASE_URL: 'postgres://user:pass@host/db?ssl=no-verify', PGSSL: 'verify-full' })))
      .toThrow('DATABASE_URL must be a valid PostgreSQL URL');
    expect(() => validateEnvironment(configured({ DATABASE_URL: 'postgres://user:pass@host/db?ssl=0', PGSSL: 'verify-full' })))
      .toThrow('DATABASE_URL must be a valid PostgreSQL URL');
    expect(validateEnvironment(configured({
      DATABASE_URL: 'postgres://user:pass@host/db', PGSSL: 'verify-full',
    })).database.sslMode).toBe('verify-full');
  });

  it('rejects conflicting connection configuration and unsupported TLS modes', () => {
    expect(() => validateEnvironment(configured({ DATABASE_URL: 'postgres://user:pass@host/db', PGHOST: 'host' }))).toThrow(
      'use DATABASE_URL or PG* settings, not both',
    );
    expect(() => validateEnvironment(configured({ PGSSL: 'require' }))).toThrow('PGSSL must be disable or verify-full');
  });
});
