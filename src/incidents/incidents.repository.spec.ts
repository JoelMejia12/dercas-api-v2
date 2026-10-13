import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { IncidentHistoryQueryDto } from './incident-history-query.dto';
import {
  IncidentIdempotencyConflictError,
  IncidentsRepository,
  NoActiveAssignedVehicleError,
} from './incidents.repository';

function incidentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '31', vehicle_id: '22', movement_id: '9', type: 'FALLA_VEHICULO', priority: 'MEDIA',
    description: 'Falla en frenos', status: 'ABIERTA', reported_at: new Date('2026-05-01T12:00:00Z'),
    closed_at: null, user_id: '8', operation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', latitude: null, longitude: null, ...overrides,
  };
}

describe('IncidentsRepository', () => {
  it('creates an incident for the current assigned vehicle within an audited transaction', async () => {
    const txQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [incidentRow()] });
    const auditContexts: unknown[] = [];
    const transaction = vi.fn(async (work: (tx: never) => Promise<unknown>, audit: unknown) => {
      auditContexts.push(audit);
      return work({ query: txQuery } as never);
    });
    const repository = new IncidentsRepository({ transaction } as unknown as DatabaseService);
    await expect(repository.create({
      userId: '8', type: 'FALLA_VEHICULO', description: 'Falla en frenos',
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auditIp: '192.0.2.8',
    })).resolves.toMatchObject({ id: '31', vehicleId: '22', status: 'ABIERTA', priority: 'MEDIA' });
    expect(auditContexts).toEqual([{ userId: '8', ip: '192.0.2.8' }]);
    const [insertSql, insertValues] = txQuery.mock.calls[1] as [string, unknown[]];
    expect(insertSql).toContain('FROM gacor.asignaciones_vehiculo a');
    expect(insertSql).toContain('a.piloto_id = $1::bigint');
    expect(insertSql).toContain('ON CONFLICT (uuid_operacion) DO NOTHING');
    expect(insertValues).toEqual(['8', 'FALLA_VEHICULO', 'Falla en frenos', null, null, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });

  it('replays an identical idempotent operation without inserting again', async () => {
    const txQuery = vi.fn().mockResolvedValueOnce({ rows: [incidentRow()] });
    const transaction = vi.fn(async (work: (tx: never) => Promise<unknown>) => work({ query: txQuery } as never));
    const repository = new IncidentsRepository({ transaction } as unknown as DatabaseService);
    await expect(repository.create({
      userId: '8', type: 'FALLA_VEHICULO', description: 'Falla en frenos',
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auditIp: '192.0.2.8',
    })).resolves.toMatchObject({ id: '31' });
    expect(txQuery).toHaveBeenCalledOnce();
  });

  it('rejects a reused operation UUID with a different payload', async () => {
    const txQuery = vi.fn().mockResolvedValueOnce({ rows: [incidentRow({ description: 'Otra descripción' })] });
    const transaction = vi.fn(async (work: (tx: never) => Promise<unknown>) => work({ query: txQuery } as never));
    await expect(new IncidentsRepository({ transaction } as unknown as DatabaseService).create({
      userId: '8', type: 'FALLA_VEHICULO', description: 'Falla en frenos',
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auditIp: '192.0.2.8',
    })).rejects.toBeInstanceOf(IncidentIdempotencyConflictError);
    expect(txQuery).toHaveBeenCalledOnce();
  });

  it('fails if the user has no active assigned vehicle', async () => {
    const txQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ exists: false }] });
    const transaction = vi.fn(async (work: (tx: never) => Promise<unknown>) => work({ query: txQuery } as never));
    await expect(new IncidentsRepository({ transaction } as unknown as DatabaseService).create({
      userId: '8', type: 'OTRO', description: 'Observación',
      operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auditIp: '192.0.2.8',
    })).rejects.toBeInstanceOf(NoActiveAssignedVehicleError);
  });

  it('lists incidents only for the supplied authenticated user and uses stable pagination', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [incidentRow()] });
    const repository = new IncidentsRepository({ query } as unknown as DatabaseService);
    await expect(repository.findHistoryForUser('8', Object.assign(new IncidentHistoryQueryDto(), { limit: 25, offset: 0 })))
      .resolves.toMatchObject({ rows: [{ id: '31', vehicleId: '22' }], hasMore: false });
    expect(query.mock.calls[0]?.[0]).toContain('WHERE i.usuario_id = $1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY i.fecha_hora DESC, i.id DESC');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', 26, 0, null]);
  });

  it('filters the own incident history by PANICO when requested', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [incidentRow({ type: 'PANICO' })] });
    const repository = new IncidentsRepository({ query } as unknown as DatabaseService);
    await repository.findHistoryForUser('8', Object.assign(new IncidentHistoryQueryDto(), { type: 'PANICO' }));
    expect(query.mock.calls[0]?.[0]).toContain('i.tipo::text = $4::text');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', 26, 0, 'PANICO']);
  });

  it('persists an idempotent PANICO incidence with optional coordinates and the authenticated actor', async () => {
    const txQuery = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [incidentRow({ type: 'PANICO', latitude: '14.500000', longitude: '-90.500000' })] });
    const transaction = vi.fn(async (work: (tx: never) => Promise<unknown>) => work({ query: txQuery } as never));
    const repository = new IncidentsRepository({ transaction } as unknown as DatabaseService);
    await expect(repository.create({ userId: '8', type: 'PANICO', description: 'Emergencia', operationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auditIp: '192.0.2.8', latitude: '14.5', longitude: '-90.5' }))
      .resolves.toMatchObject({ type: 'PANICO', latitude: '14.500000', longitude: '-90.500000' });
    const [sql, values] = txQuery.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT (uuid_operacion) DO NOTHING');
    expect(values).toEqual(['8', 'PANICO', 'Emergencia', '14.5', '-90.5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });

  it('returns no incident for a missing or non-owned ID and rejects invalid BIGINT IDs', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new IncidentsRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('31', '8')).resolves.toBeNull();
    await expect(repository.findByIdForUser('9223372036854775808', '8')).rejects.toThrow('Invalid value for incidentId');
    expect(query).toHaveBeenCalledOnce();
  });

  it('propagates read and write errors without converting them into successful responses', async () => {
    const query = vi.fn().mockRejectedValue(new Error('database failure'));
    await expect(new IncidentsRepository({ query } as unknown as DatabaseService)
      .findHistoryForUser('8', new IncidentHistoryQueryDto())).rejects.toThrow('database failure');
  });

  it('uses actual incident columns, enums, uniqueness, and audit trigger declarations', () => {
    const schema = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const table = schema.match(/CREATE TABLE incidencias \(([\s\S]*?)\n\);/)?.[1];
    expect(table).toContain('usuario_id BIGINT NOT NULL REFERENCES usuarios(id)');
    expect(table).toContain('vehiculo_id BIGINT REFERENCES vehiculos(id)');
    expect(table).toContain('movimiento_id BIGINT REFERENCES movimientos_vehiculo(id)');
    expect(table).toContain('uuid_operacion UUID NOT NULL UNIQUE');
    expect(schema).toContain("CREATE TYPE tipo_incidencia_enum AS ENUM ('FALLA_VEHICULO','OBSERVACION_VEHICULO','ACCIDENTE','PANICO','OTRO');");
    expect(schema).toContain("CREATE TYPE estado_incidencia_enum AS ENUM ('ABIERTA','RECIBIDA','EN_ATENCION','CERRADA','CANCELADA');");
    expect(schema).toContain("'incidencias'");
    expect(schema).toContain('EXECUTE FUNCTION fn_auditar_cambios()');
  });
});
