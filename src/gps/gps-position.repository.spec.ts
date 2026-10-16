import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { GpsPositionIdempotencyConflictError, GpsPositionInput, GpsPositionRepository } from './gps-position.repository';

const baseInput: GpsPositionInput = {
  sessionId: '12', deviceId: '15', longitude: -90.5, latitude: 14.6,
  capturedAt: new Date('2026-10-12T11:59:00Z'),
  operationId: 'c9ab8ac0-4094-4bf1-bded-cf9f84fa34e5',
};

function repositoryWithQuery(query: ReturnType<typeof vi.fn>): GpsPositionRepository {
  const database = {
    query,
    transaction: (work: (tx: { query: typeof query }) => Promise<unknown>) => work({ query }),
  };
  return new GpsPositionRepository(database as unknown as DatabaseService);
}

describe('GpsPositionRepository', () => {
  it('matches GPS insert columns, PostgreSQL types, foreign keys, and session trigger rules', () => {
    const schema = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const gpsTable = schema.match(/CREATE TABLE posiciones_gps \(([\s\S]*?)\n\) PARTITION BY RANGE/)?.[1];
    expect(gpsTable).toBeDefined();
    for (const column of [
      'id BIGINT GENERATED ALWAYS AS IDENTITY',
      'fecha_hora_servidor TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      'sesion_seguimiento_id BIGINT NOT NULL REFERENCES sesiones_seguimiento(id) ON DELETE RESTRICT',
      'dispositivo_id BIGINT NOT NULL REFERENCES dispositivos(id) ON DELETE RESTRICT',
      'ubicacion GEOGRAPHY(POINT,4326) NOT NULL',
      'precision_metros NUMERIC(8,2)',
      'velocidad_kmh NUMERIC(8,2)',
      'rumbo_grados NUMERIC(6,2)',
      'altitud_metros NUMERIC(9,2)',
      'bateria_porcentaje SMALLINT',
      'fecha_hora_dispositivo TIMESTAMPTZ NOT NULL',
      'uuid_operacion UUID NOT NULL',
      'PRIMARY KEY (id, fecha_hora_servidor)',
      'UNIQUE (uuid_operacion, fecha_hora_servidor)',
    ]) expect(gpsTable).toContain(column);
    expect(schema).toContain('CREATE EXTENSION IF NOT EXISTS postgis;');
    expect(schema).toContain('s.dispositivo_id<>NEW.dispositivo_id');
    expect(schema).toContain("s.estado<>'ACTIVO'");
  });

  it('inserts GPS using bound values and lets database triggers bind session context', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '77', fecha_hora_servidor: new Date('2026-10-12T12:00:00Z') }] });
    const repository = repositoryWithQuery(query);
    await expect(repository.insert(baseInput)).resolves.toEqual({ id: '77', serverReceivedAt: new Date('2026-10-12T12:00:00Z') });

    const [lockSql, lockValues] = query.mock.calls[0] as [string, unknown[]];
    expect(lockSql).toContain('pg_advisory_xact_lock(hashtextextended($1::text, 0))');
    expect(lockValues).toEqual([baseInput.operationId]);
    const [lookupSql] = query.mock.calls[1] as [string, unknown[]];
    expect(lookupSql).toContain('WHERE uuid_operacion = $1::uuid');
    const [sql, values] = query.mock.calls[2] as [string, unknown[]];
    expect(sql).toContain('ST_SetSRID(ST_MakePoint($3::double precision, $4::double precision), 4326)::geography');
    expect(sql).toContain('RETURNING id, fecha_hora_servidor');
    expect(values).toEqual([
      '12', '15', -90.5, 14.6, null, null, null, null, null, baseInput.capturedAt, baseInput.operationId,
    ]);
    expect(sql).not.toContain('-90.5');
  });

  it('reuses an existing position for the same operation and rejects a changed payload', async () => {
    const existing = {
      id: '77', fecha_hora_servidor: new Date('2026-10-12T12:00:00Z'),
      sesion_seguimiento_id: baseInput.sessionId, dispositivo_id: baseInput.deviceId,
      longitude: baseInput.longitude, latitude: baseInput.latitude, precision_metros: null,
      velocidad_kmh: null, rumbo_grados: null, altitud_metros: null, bateria_porcentaje: null,
      fecha_hora_dispositivo: baseInput.capturedAt,
    };
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existing] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existing] });
    const repository = repositoryWithQuery(query);
    await expect(repository.insert(baseInput)).resolves.toEqual({ id: '77', serverReceivedAt: existing.fecha_hora_servidor });
    await expect(repository.insert({ ...baseInput, latitude: 14.7 })).rejects.toBeInstanceOf(GpsPositionIdempotencyConflictError);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('rejects coordinates and metadata values that violate the GPS table checks without querying', async () => {
    const query = vi.fn();
    const repository = repositoryWithQuery(query);
    const base = baseInput;
    await expect(repository.insert({ ...base, latitude: 90.1 })).rejects.toThrow('Invalid value for latitude');
    await expect(repository.insert({ ...base, longitude: undefined as unknown as number })).rejects.toThrow('Invalid value for longitude');
    await expect(repository.insert({ ...base, headingDegrees: 360 })).rejects.toThrow('Invalid value for headingDegrees');
    await expect(repository.insert({ ...base, headingDegrees: 359.995 })).rejects.toThrow('Invalid value for headingDegrees');
    await expect(repository.insert({ ...base, accuracyMeters: -0.01 })).rejects.toThrow('Invalid value for accuracyMeters');
    await expect(repository.insert({ ...base, speedKmh: 1_000_000 })).rejects.toThrow('Invalid value for speedKmh');
    await expect(repository.insert({ ...base, speedKmh: 999_999.995 })).rejects.toThrow('Invalid value for speedKmh');
    await expect(repository.insert({ ...base, altitudeMeters: 9_999_999.995 })).rejects.toThrow('Invalid value for altitudeMeters');
    await expect(repository.insert({ ...base, batteryPercentage: 101 })).rejects.toThrow('Invalid value for batteryPercentage');
    await expect(repository.insert({ ...base, operationId: 'not-a-uuid' })).rejects.toThrow('Invalid value for operationId');
    await expect(repository.insert({ ...base, sessionId: '9223372036854775808' })).rejects.toThrow('Invalid value for sessionId');
    expect(query).not.toHaveBeenCalled();
  });
});
