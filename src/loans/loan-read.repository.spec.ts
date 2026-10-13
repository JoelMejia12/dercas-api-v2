import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { LoanReadRepository } from './loan-read.repository';

const row = {
  id: '9223372036854775807', status: 'ACTIVO', requested_at: new Date('2025-01-01T12:00:00Z'),
  key_withdrawn_at: null, use_started_at: null, use_ended_at: null, key_returned_at: null,
  destination: 'Destino', reason: null, return_observations: null,
  vehicle_id: '9223372036854775806', vehicle_plate: 'P-123', vehicle_make: 'Marca', vehicle_model: null,
  vehicle_kind: 'ADMINISTRATIVO', vehicle_operational_state: 'DISPONIBLE',
  movement_id: null, movement_state: null, movement_started_at: null, movement_ended_at: null,
  initial_odometer_id: null, initial_odometer_value: null, initial_odometer_type: null, initial_odometer_at: null,
  final_odometer_id: null, final_odometer_value: null, final_odometer_type: null, final_odometer_at: null,
};

describe('LoanReadRepository', () => {
  it('queries only SQL-defined loan, vehicle, movement, and odometer fields', () => {
    const sql = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const ddl = sql.match(/CREATE TABLE prestamos_administrativos \(([\s\S]*?)\n\);/)?.[1];
    expect(ddl).toBeDefined();
    for (const field of ['id BIGINT', 'vehiculo_id BIGINT', 'usuario_id BIGINT', 'movimiento_id BIGINT', 'fecha_hora_solicitud TIMESTAMPTZ', 'fecha_hora_retiro_llave TIMESTAMPTZ', 'fecha_hora_inicio_uso TIMESTAMPTZ', 'fecha_hora_fin_uso TIMESTAMPTZ', 'fecha_hora_retorno_llave TIMESTAMPTZ', 'destino TEXT', 'motivo TEXT', 'observaciones_fin TEXT', 'estado estado_prestamo_enum']) {
      expect(ddl).toContain(field);
    }
    expect(sql).toContain("CREATE TYPE estado_prestamo_enum AS ENUM ('SOLICITADO','LLAVE_LIBERADA','LLAVE_RETIRADA','PENDIENTE_ODOMETRO','ACTIVO','PENDIENTE_RETORNO_LLAVE','FINALIZADO','CANCELADO');");
  });

  it('reads active nonterminal loans using own-user scope and SQL-index terminal states', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new LoanReadRepository({ query } as unknown as DatabaseService);
    const result = await repository.findActiveForUser('8');
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual(['8']);
    expect(sql).toContain('FROM gacor.prestamos_administrativos p');
    expect(sql).toContain('WHERE p.usuario_id = $1::bigint');
    expect(sql).toContain("p.estado NOT IN ('FINALIZADO'::gacor.estado_prestamo_enum, 'CANCELADO'::gacor.estado_prestamo_enum)");
    expect(sql).toContain('ORDER BY p.fecha_hora_solicitud DESC, p.id DESC');
    expect(result[0]?.id).toBe(row.id);
    expect(result[0]?.vehicle.id).toBe(row.vehicle_id);
    expect(result[0]?.movement).toBeNull();
  });

  it('uses parameterized pagination and deterministic ordering for history', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new LoanReadRepository({ query } as unknown as DatabaseService);
    await expect(repository.findHistoryForUser('8', { limit: 25, offset: 50 })).resolves.toEqual([]);
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(values).toEqual(['8', 26, 50]);
    expect(sql).toContain('LIMIT $2::integer OFFSET $3::integer');
    expect(sql).toContain('ORDER BY p.fecha_hora_solicitud DESC, p.id DESC');
  });

  it('returns an empty active list and rejects invalid BIGINT IDs before querying', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new LoanReadRepository({ query } as unknown as DatabaseService);
    await expect(repository.findActiveForUser('8')).resolves.toEqual([]);
    await expect(repository.findHistoryForUser('9223372036854775808', { limit: 25, offset: 0 })).rejects.toThrow('Invalid value for userId');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reads requestable vehicles from the official availability view and only reports online cabinets', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      vehicle_id: '22', plate: 'ABC-123', make: 'Marca', model: null, latest_kilometers: '12345.6',
    }] });
    const repo = new LoanReadRepository({ query } as unknown as DatabaseService);
    await expect(repo.findAvailableAdministrativeVehicles({ limit: 5, offset: 10 })).resolves.toEqual({
      items: [{ vehicle: { id: '22', plate: 'ABC-123', make: 'Marca', model: null }, latestKilometers: '12345.6' }],
      hasMore: false,
    });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM gacor.vw_vehiculos_administrativos_disponibles');
    expect(sql).toContain("cabinet.estado='ONLINE'::gacor.estado_gabinete_enum");
    expect(sql).toContain('ORDER BY available.placa, available.vehiculo_id');
    expect(values).toEqual([6, 10]);
  });
});
