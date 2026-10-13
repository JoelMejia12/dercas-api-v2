import { describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { SecureLogger } from '../common/logging/secure-logger.service';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  it('runs parameterized queries and returns results', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: '1' }], rowCount: 1 });
    const service = new DatabaseService(
      { query, end: vi.fn() } as unknown as Pool,
      {} as SecureLogger,
    );

    const result = await service.query<{ id: string }>('SELECT id FROM gacor.vehiculos WHERE id = $1', ['1']);

    expect(result.rows).toEqual([{ id: '1' }]);
    expect(query).toHaveBeenCalledWith('SELECT id FROM gacor.vehiculos WHERE id = $1', ['1']);
  });

  it('rolls back and releases a client when a transaction fails', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('operation failed'))
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client), end: vi.fn() };
    const service = new DatabaseService(pool as unknown as Pool, {
      error: vi.fn(),
    } as unknown as SecureLogger);

    await expect(service.transaction(async (queryable) => queryable.query('UPDATE x SET y = $1', ['v'])))
      .rejects.toThrow('operation failed');

    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'UPDATE x SET y = $1', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('destroys a client when rollback fails instead of returning it to the pool', async () => {
    const rollbackError = new Error('socket closed');
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('query failed'))
        .mockRejectedValueOnce(rollbackError),
      release: vi.fn(),
    };
    const service = new DatabaseService(
      { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool,
      { error: vi.fn() } as unknown as SecureLogger,
    );

    await expect(service.transaction(async (queryable) => queryable.query('SELECT 1')))
      .rejects.toThrow('query failed');
    expect(client.release).toHaveBeenCalledWith(rollbackError);
  });

  it('commits successful transactions and releases the client once', async () => {
    const client = { query: vi.fn().mockResolvedValue({}), release: vi.fn() };
    const service = new DatabaseService(
      { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool,
      {} as SecureLogger,
    );

    await expect(service.transaction(async () => 'saved')).resolves.toBe('saved');
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith();
  });

  it('sets parameterized actor and IP context after BEGIN and before writes, with transaction scope', async () => {
    const client = { query: vi.fn().mockResolvedValue({}), release: vi.fn() };
    const service = new DatabaseService(
      { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool,
      {} as SecureLogger,
    );

    await service.transaction(
      async (tx) => tx.query('INSERT INTO gacor.prestamos_administrativos (usuario_id) VALUES ($1)', ['41']),
      { userId: '41', ip: '198.51.100.24' },
    );

    const calls = client.query.mock.calls;
    expect(calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      expect.stringContaining("set_config('app.user_id', $1::bigint::text, true)"),
      expect.stringContaining('INSERT INTO gacor.prestamos_administrativos'),
      'COMMIT',
    ]);
    expect(calls[1]?.[1]).toEqual(['41', '198.51.100.24']);
    expect(calls[1]?.[0]).not.toMatch(/\bSET\s/i);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client if audit context configuration fails', async () => {
    const failure = new Error('invalid inet value');
    const client = {
      query: vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(failure).mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const service = new DatabaseService(
      { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool,
      {} as SecureLogger,
    );

    await expect(service.transaction(async () => 'must not run', { userId: '41', ip: 'invalid' })).rejects.toThrow(failure);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN', expect.stringContaining('set_config'), 'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back an audited write failure after context setup', async () => {
    const failure = new Error('insert failed');
    const client = {
      query: vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockRejectedValueOnce(failure).mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const service = new DatabaseService(
      { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool,
      {} as SecureLogger,
    );

    await expect(service.transaction(
      (tx) => tx.query('INSERT INTO gacor.prestamos_administrativos DEFAULT VALUES'),
      { userId: '41', ip: '198.51.100.24' },
    )).rejects.toThrow(failure);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN', expect.stringContaining('set_config'), 'INSERT INTO gacor.prestamos_administrativos DEFAULT VALUES', 'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('does not attempt a database connection when VPS settings are absent', async () => {
    const service = new DatabaseService(undefined, {} as SecureLogger);
    expect(service.isConfigured).toBe(false);
    await expect(service.query('SELECT 1')).rejects.toThrow('Database connection is not configured');
    await expect(service.checkAvailability()).resolves.toBe(false);
  });

  it('closes the pool on module shutdown', async () => {
    const end = vi.fn().mockResolvedValue(undefined);
    const service = new DatabaseService({ end } as unknown as Pool, {} as SecureLogger);
    await service.onModuleDestroy();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
