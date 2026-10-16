import { describe, expect, it } from 'vitest';
import { buildPoolConfig } from './database.module';

describe('buildPoolConfig', () => {
  it('does not construct a pool without either connection form', () => {
    expect(buildPoolConfig({ sslMode: 'disable' })).toBeUndefined();
  });

  it('uses explicit certificate and hostname verification for verify-full', () => {
    const config = buildPoolConfig({ host: 'db.internal', database: 'dercas_test', user: 'api', password: 'not-logged', sslMode: 'verify-full' });
    expect(config?.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('sets the GACOR schema search path for database connections', () => {
const config = buildPoolConfig({ host: 'localhost', database: 'dercas_test', user: 'api', password: 'not-logged', sslMode: 'disable' });
expect(config?.options).toBe('-c search_path=gacor,public');
});

  it('sets TLS disabled explicitly so ambient PGSSLMODE cannot silently change policy', () => {
    const config = buildPoolConfig({ host: 'localhost', database: 'dercas_test', user: 'api', password: 'not-logged', sslMode: 'disable' });
    expect(config?.ssl).toBe(false);
  });

  it('retains the approved DATABASE_URL sslmode=verify-full parsing path', () => {
    const config = buildPoolConfig({
      connectionString: 'postgresql://api:secret@db.internal/dercas_test?sslmode=verify-full',
      sslMode: 'disable',
    });
    expect(config?.connectionString).toContain('?sslmode=verify-full');
    // The node-postgres URL parser overlays sslmode=verify-full as a TLS object
    // with Node's default rejectUnauthorized=true. We don't expose or log it here.
  });
});
