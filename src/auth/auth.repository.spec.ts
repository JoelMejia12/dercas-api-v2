import { describe, expect, it, vi } from 'vitest';
import { AuthRepository } from './auth.repository';
import { DatabaseService } from '../database/database.service';

describe('AuthRepository authentication SQL', () => {
  it('closes an expired open device session before the partial unique-index insert', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: '2' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: '8', usuario_id: '2', dispositivo_id: '3', estado: 'ABIERTA' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    const database = { transaction: (work: (tx: { query: typeof query }) => Promise<unknown>) => work({ query }) };
    await new AuthRepository(database as never).createSession('2', '3', 'hash', '192.0.2.1', 'user-hash', 'device-hash');
    expect(query.mock.calls[0]?.[0]).toContain('FOR UPDATE OF u, d');
    expect(query.mock.calls[0]?.[0]).toContain('u.password_hash = $3 AND d.device_token_hash = $4');
    expect(query.mock.calls[1]?.[0]).toContain("estado = 'CERRADA'::gacor.estado_sesion_dispositivo_enum");
    expect(query.mock.calls[1]?.[0]).toContain("login_at <= NOW() - ($2::integer * INTERVAL '1 second')");
    expect(query.mock.calls[2]?.[0]).toContain("'ABIERTA'::gacor.estado_sesion_dispositivo_enum");
    expect(query.mock.calls.map((call) => call[1])).toEqual([
      ['2', '3', 'user-hash', 'device-hash'], ['3', 2_592_000],
      ['3', '2', 'hash', '192.0.2.1'], ['2'],
    ]);
  });

  it('does not clean up or insert if the active user/device identity changed before session creation', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const database = { transaction: (work: (tx: { query: typeof query }) => Promise<unknown>) => work({ query }) };
    await expect(new AuthRepository(database as never).createSession('2', '3', 'hash', undefined, 'old-user-hash', 'old-device-hash'))
      .rejects.toThrow('Authentication identity changed during login');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('u.activo = TRUE AND d.activo = TRUE');
  });

  it('rolls back cleanup and session insertion if the final login update fails', async () => {
    const failure = new Error('last login update failed');
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: '2' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: '8', usuario_id: '2', dispositivo_id: '3', estado: 'ABIERTA' }] })
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce({}),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const database = new DatabaseService(pool as never, { error: vi.fn() } as never);
    const repository = new AuthRepository(database);

    await expect(repository.createSession('2', '3', 'hash', undefined, 'user-hash', 'device-hash')).rejects.toThrow(failure);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN', expect.stringContaining('FOR UPDATE OF u, d'), expect.stringContaining('login_at <='),
      expect.stringContaining('INSERT INTO gacor.sesiones_dispositivo'), 'UPDATE gacor.usuarios SET ultimo_acceso_at = NOW() WHERE id = $1::bigint AND activo = TRUE', 'ROLLBACK',
    ]);
    expect(client.query.mock.calls.map(([sql]) => sql)).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('conditionally rotates only the currently stored refresh hash and checks the absolute session age', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const database = { transaction: (work: (tx: { query: typeof query }) => Promise<unknown>) => work({ query }) };
    const rotated = await new AuthRepository(database as never).rotateRefresh('9', 'old-hash', 'new-hash', 2_592_000);
    expect(rotated).toBe(false);
    expect(query.mock.calls[0]?.[0]).toContain('s.refresh_token_hash = $2');
    expect(query.mock.calls[0]?.[0]).toContain('s.login_at > NOW() - ($4::integer * INTERVAL');
    expect(query.mock.calls[0]?.[1]).toEqual(['9', 'old-hash', 'new-hash', 2_592_000]);
  });

  it('loads session validity and active role permissions in one authorization query', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const repository = new AuthRepository({ query } as never);
    await expect(repository.findActivePrincipal('2', '8', '3')).resolves.toBeUndefined();
    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain("s.estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum");
    expect(sql).toContain('s.login_at > NOW() - ($4::integer * INTERVAL');
    expect(sql).toContain('u.activo = TRUE AND d.activo = TRUE');
    expect(sql).toContain('LEFT JOIN gacor.usuario_rol');
    expect(sql).toContain('LEFT JOIN gacor.rol_permiso');
    expect(sql).toContain('LEFT JOIN gacor.permisos');
    expect(sql).toContain('SELECT DISTINCT p.codigo');
    expect(values).toEqual(['8', '2', '3', 2_592_000]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('returns current active grants while keeping a valid unassigned session authenticated with no permissions', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ codigo: 'JORNADA_INICIAR' }, { codigo: 'VEHICULO_USAR_ASIGNADO' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ codigo: null }] });
    const repository = new AuthRepository({ query } as never);

    await expect(repository.findActivePrincipal('2', '8', '3')).resolves.toEqual([
      'JORNADA_INICIAR', 'VEHICULO_USAR_ASIGNADO',
    ]);
    await expect(repository.findActivePrincipal('2', '8', '3')).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('uses only SQL enum states defined by the schema when logging out or revoking', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const repository = new AuthRepository({ query } as never);
    await repository.closeSession('9', '2', '192.0.2.1');
    await repository.revoke('10', '2', '192.0.2.1');
    expect(query.mock.calls[0]?.[0]).toContain("'CERRADA'::gacor.estado_sesion_dispositivo_enum");
    expect(query.mock.calls[1]?.[0]).toContain("'REVOCADA'::gacor.estado_sesion_dispositivo_enum");
    for (const [index, [sql, values]] of query.mock.calls.entries()) {
      expect(sql).toContain('WHERE id = $1::bigint AND usuario_id = $2::bigint');
      expect(values).toEqual([index === 0 ? '9' : '10', '2', '192.0.2.1']);
    }
  });
});
