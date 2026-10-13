import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { FuelIdempotencyConflictError, FuelRepository } from './fuel.repository';

describe('FuelRepository', () => {
  const row = {
    id: '17', occurred_at: new Date('2026-04-01T12:30:00Z'), gallons: '8.250', price_per_gallon: '31.75',
    total_paid: '261.94', observations: null, gas_station_id: '3', gas_station_name: 'Estación Central',
    manual_name: null, latitude: null, longitude: null, vehicle_id: '22', vehicle_plate: 'ABC-123',
    movement_id: '9', movement_type: 'JORNADA_BRIGADA', movement_state: 'ABIERTO', loan_id: null,
    journey_id: '6', odometer_id: '12', odometer_kilometers: '12345.6',
    odometer_recorded_at: new Date('2026-04-01T12:20:00Z'), odometer_photo_url: null,
  };

  it('returns schema-backed fuel, movement, vehicle, and odometer fields as precision-safe values', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new FuelRepository({ query } as unknown as DatabaseService);
    await expect(repository.findHistoryForUser('8', { limit: 25, offset: 0 })).resolves.toEqual([{
      id: '17', occurredAt: '2026-04-01T12:30:00.000Z', gallons: '8.250', pricePerGallon: '31.75', totalPaid: '261.94',
      observations: null,
      location: { gasStationId: '3', gasStationName: 'Estación Central', manualName: null, latitude: null, longitude: null },
      vehicle: { id: '22', plate: 'ABC-123' },
      movement: { id: '9', type: 'JORNADA_BRIGADA', state: 'ABIERTO', loanId: null, journeyId: '6' },
      odometer: { id: '12', kilometers: '12345.6', recordedAt: '2026-04-01T12:20:00.000Z', photoUrl: null },
    }]);
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE mv.usuario_id = $1::bigint');
    expect(sql).toContain('ORDER BY cc.fecha_hora DESC, cc.id DESC');
    expect(values).toEqual(['8', 26, 0]);
  });

  it('returns an empty history for a user without visible records', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(new FuelRepository({ query } as unknown as DatabaseService)
      .findHistoryForUser('8', { limit: 25, offset: 0 })).resolves.toEqual([]);
  });

  it('validates the authenticated user BIGINT before querying', async () => {
    const query = vi.fn();
    await expect(new FuelRepository({ query } as unknown as DatabaseService)
      .findHistoryForUser('9223372036854775808', { limit: 25, offset: 0 })).rejects.toThrow('Invalid value for userId');
    expect(query).not.toHaveBeenCalled();
  });

  it('propagates database errors to the shared HTTP error handler', async () => {
    const query = vi.fn().mockRejectedValue(new Error('query failed'));
    await expect(new FuelRepository({ query } as unknown as DatabaseService)
      .findHistoryForUser('8', { limit: 25, offset: 0 })).rejects.toThrow('query failed');
  });

  it('scopes individual reads to the authenticated owner', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new FuelRepository({ query } as unknown as DatabaseService);
    await repository.findByIdForUser('17', '8');
    expect(query.mock.calls[0]?.[0]).toContain('WHERE cc.id = $1::bigint AND mv.usuario_id = $2::bigint');
    expect(query.mock.calls[0]?.[1]).toEqual(['17', '8']);
  });

  it('creates the odometer reading and fuel charge atomically with actor audit context', async () => {
    const txQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // Existing idempotency key
      .mockResolvedValueOnce({ rows: [{ id: '9' }] }) // Owned movement
      .mockResolvedValueOnce({ rows: [{ id: '30' }] }) // Odometer
      .mockResolvedValueOnce({ rows: [{ id: '31', movement_id: '9', occurred_at: new Date('2026-05-01T12:00:00Z') }] });
    const transaction = vi.fn(async (work, audit) => {
      expect(audit).toEqual({ userId: '8', ip: '192.0.2.8' });
      return work({ query: txQuery });
    });
    const repository = new FuelRepository({ transaction } as unknown as DatabaseService);
    const created = await repository.create({
      userId: '8', movementId: '9', operationId: '11111111-1111-4111-8111-111111111111',
      kilometers: '12345.6', deviceAt: '2026-05-01T11:59:00Z', gallons: '8.250',
      pricePerGallon: '31.75', totalPaid: '261.94', auditIp: '192.0.2.8',
    });
    expect(created).toEqual({ id: '31', movementId: '9', odometerId: '30', occurredAt: '2026-05-01T12:00:00.000Z' });
    expect(txQuery).toHaveBeenCalledTimes(4);
    expect(txQuery.mock.calls[2]?.[0]).toContain("'COMBUSTIBLE'::gacor.tipo_lectura_odometro_enum");
    expect(txQuery.mock.calls[2]?.[1]).toEqual(['9', '8', '12345.6', '2026-05-01T11:59:00.000Z', '11111111-1111-4111-8111-111111111111']);
    expect(txQuery.mock.calls[3]?.[0]).toContain('INSERT INTO gacor.cargas_combustible');
  });

  it('rolls back the unit of work when the fuel write fails', async () => {
    const txQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '9' }] })
      .mockResolvedValueOnce({ rows: [{ id: '30' }] })
      .mockRejectedValueOnce(new Error('write failed'));
    const transaction = vi.fn((work) => work({ query: txQuery }));
    await expect(new FuelRepository({ transaction } as unknown as DatabaseService).create({
      userId: '8', movementId: '9', operationId: '11111111-1111-4111-8111-111111111111',
      kilometers: '12345.6', deviceAt: '2026-05-01T11:59:00Z', gallons: '8.250',
      pricePerGallon: '31.75', totalPaid: '261.94', auditIp: '192.0.2.8',
    })).rejects.toThrow('write failed');
    expect(transaction).toHaveBeenCalledOnce();
  });

  it('rejects a reused UUID if it belongs to another request payload', async () => {
    const prior = {
      id: '31', movement_id: '9', user_id: '8', odometer_kilometers: '12345.6',
      device_at: new Date('2026-05-01T11:59:00Z'), gallons: '8.250', price_per_gallon: '31.75',
      total_paid: '261.94', gas_station_id: null, latitude: null, longitude: null, manual_name: null,
      observations: null, odometer_id: '30', occurred_at: new Date('2026-05-01T12:00:00Z'),
    };
    const query = vi.fn().mockResolvedValue({ rows: [prior] });
    const transaction = vi.fn((work) => work({ query }));
    await expect(new FuelRepository({ transaction } as unknown as DatabaseService).create({
      userId: '8', movementId: '9', operationId: '11111111-1111-4111-8111-111111111111',
      kilometers: '12345.6', deviceAt: '2026-05-01T11:59:00Z', gallons: '9.000',
      pricePerGallon: '31.75', totalPaid: '261.94', auditIp: '192.0.2.8',
    })).rejects.toBeInstanceOf(FuelIdempotencyConflictError);
  });

  it('uses columns and relations declared in the official SQL', () => {
    const sql = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const charges = sql.match(/CREATE TABLE cargas_combustible \(([\s\S]*?)\n\);/)?.[1];
    const movements = sql.match(/CREATE TABLE movimientos_vehiculo \(([\s\S]*?)\n\);/)?.[1];
    const readings = sql.match(/CREATE TABLE lecturas_odometro \(([\s\S]*?)\n\);/)?.[1];
    expect(charges).toContain('movimiento_id BIGINT NOT NULL REFERENCES movimientos_vehiculo(id)');
    expect(charges).toContain('lectura_odometro_id BIGINT NOT NULL REFERENCES lecturas_odometro(id)');
    expect(charges).toContain('galones NUMERIC(10,3) NOT NULL CHECK (galones > 0)');
    expect(charges).toContain('uuid_operacion UUID NOT NULL UNIQUE');
    expect(movements).toContain('usuario_id BIGINT NOT NULL REFERENCES usuarios(id)');
    expect(movements).toContain('vehiculo_id BIGINT NOT NULL REFERENCES vehiculos(id)');
    expect(readings).toContain('tipo_lectura tipo_lectura_odometro_enum');
    expect(sql).toContain("'COMBUSTIBLE'");
    expect(sql).toContain('CREATE TABLE evidencias (');
    expect(sql).toContain('tipo_entidad VARCHAR(60) NOT NULL');
    expect(sql).toContain('entidad_id BIGINT NOT NULL');
  });
});
