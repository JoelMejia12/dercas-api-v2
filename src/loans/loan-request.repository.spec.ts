import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import {
  LoanRequestIdempotencyConflictError,
  LoanRequestRepository,
  LoanRequestUnavailableError,
} from './loan-request.repository';

const input = {
  vehicleId: '9', userId: '22', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  destination: 'Bodega', reason: 'Traslado', auditIp: '198.51.100.24',
};
const saved = {
  id: '9223372036854775807', vehicle_id: '9', status: 'SOLICITADO',
  requested_at: new Date('2025-02-01T12:00:00Z'), destination: 'Bodega', reason: 'Traslado',
  user_id: '22', operation_id: input.operationId,
};

function databaseWithQueries(query: ReturnType<typeof vi.fn>): DatabaseService {
  const transaction = vi.fn(async (work: (tx: { query: typeof query }) => Promise<unknown>) => work({ query }));
  return { transaction } as unknown as DatabaseService;
}

describe('LoanRequestRepository', () => {
  it('finds a request by BIGINT ID and authenticated owner using parameters', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [saved] });
    const repository = new LoanRequestRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('9223372036854775807', '22')).resolves.toEqual({
      id: saved.id, vehicleId: '9', status: 'SOLICITADO',
      requestedAt: '2025-02-01T12:00:00.000Z', destination: 'Bodega', reason: 'Traslado',
    });
    expect(query.mock.calls[0]?.[0]).toContain('WHERE id = $1::bigint AND usuario_id = $2::bigint');
    expect(query.mock.calls[0]?.[1]).toEqual(['9223372036854775807', '22']);
  });

  it('returns no row when a request is missing or owned by another user', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new LoanRequestRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('7', '22')).resolves.toBeNull();
  });

  it('rejects an out-of-range BIGINT loan ID before querying', async () => {
    const query = vi.fn();
    const repository = new LoanRequestRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('9223372036854775808', '22')).rejects.toThrow('Invalid value for loanId');
    expect(query).not.toHaveBeenCalled();
  });

  it('creates only a SOLICITADO row after locking and checking SQL-defined vehicle availability', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '9' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ vehicle_id: '9' }] })
      .mockResolvedValueOnce({ rows: [saved] });
    const repository = new LoanRequestRepository(databaseWithQueries(query));

    await expect(repository.create(input)).resolves.toEqual({
      id: saved.id, vehicleId: '9', status: 'SOLICITADO',
      requestedAt: '2025-02-01T12:00:00.000Z', destination: 'Bodega', reason: 'Traslado',
    });
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[1]).toContain('FROM gacor.vehiculos WHERE id = $1::bigint FOR UPDATE');
    expect(statements[3]).toContain('gacor.vw_vehiculos_administrativos_disponibles');
    expect(statements[3]).toContain("cabinet.estado = 'ONLINE'::gacor.estado_gabinete_enum");
    expect(statements[4]).toContain("'SOLICITADO'::gacor.estado_prestamo_enum");
    expect(statements[4]).toContain('ON CONFLICT (uuid_operacion) DO NOTHING');
    expect(statements[4]).not.toContain('movimientos_vehiculo');
    expect(statements[4]).not.toContain('lecturas_odometro');
    expect(query.mock.calls[4]?.[1]).toEqual(['9', '22', 'Bodega', 'Traslado', input.operationId]);
  });

  it('returns a matching idempotent replay without checking availability or creating a second row', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [saved] });
    const repository = new LoanRequestRepository(databaseWithQueries(query));
    await expect(repository.create(input)).resolves.toMatchObject({ id: saved.id, status: 'SOLICITADO' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an operation UUID with a different user or request payload', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [saved] });
    const repository = new LoanRequestRepository(databaseWithQueries(query));
    await expect(repository.create({ ...input, userId: '23' })).rejects.toBeInstanceOf(LoanRequestIdempotencyConflictError);
  });

  it('rejects a vehicle not in the SQL-defined available and online-cabinet view', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '9' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new LoanRequestRepository(databaseWithQueries(query));
    await expect(repository.create(input)).rejects.toBeInstanceOf(LoanRequestUnavailableError);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('maps the partial unique-index race to an unavailable conflict', async () => {
    const postgresError = Object.assign(new Error('database detail'), {
      code: '23505', constraint: 'uq_prestamo_activo_vehiculo',
    });
    const database = { transaction: vi.fn().mockRejectedValue(postgresError) } as unknown as DatabaseService;
    await expect(new LoanRequestRepository(database).create(input)).rejects.toBeInstanceOf(LoanRequestUnavailableError);
  });

  it('refuses the audited write if the explicit request IP is missing or invalid', async () => {
    const transaction = vi.fn();
    const repository = new LoanRequestRepository({ transaction } as unknown as DatabaseService);
    await expect(repository.create({ ...input, auditIp: '' })).rejects.toThrow('Invalid value for auditIp');
    expect(transaction).not.toHaveBeenCalled();
  });
});
