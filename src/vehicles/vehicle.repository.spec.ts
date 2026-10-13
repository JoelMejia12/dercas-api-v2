import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { VehicleRepository } from './vehicle.repository';
import { VehiclePageQueryDto } from './vehicle-query.dto';

describe('VehicleRepository', () => {
  it('uses columns declared by the vehicle table in the supplied schema', () => {
    const schema = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const vehicleTable = schema.match(/CREATE TABLE vehiculos \(([\s\S]*?)\n\);/)?.[1];
    expect(vehicleTable).toBeDefined();
    for (const column of ['id BIGINT', 'placa VARCHAR', 'marca VARCHAR', 'modelo VARCHAR', 'tipo tipo_vehiculo_enum', 'estado_operativo estado_operativo_vehiculo_enum', 'activo BOOLEAN']) {
      expect(vehicleTable).toContain(column);
    }
    expect(schema).toContain('CREATE SCHEMA IF NOT EXISTS gacor;');
  });

  it('uses a parameterized identifier and maps the PostgreSQL enum values', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '9', placa: 'P-123', marca: 'Marca', modelo: null,
      tipo: 'BRIGADA', estado_operativo: 'DISPONIBLE',
    }] });
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    await expect(repository.findSummaryById('9')).resolves.toEqual({
      id: '9', plate: 'P-123', make: 'Marca', model: null,
      kind: 'BRIGADA', operationalState: 'DISPONIBLE',
    });
    expect(query.mock.calls[0]?.[1]).toEqual(['9']);
    expect(query.mock.calls[0]?.[0]).toContain('WHERE id = $1');
  });

  it('rejects identifiers outside PostgreSQL BIGINT before querying', async () => {
    const query = vi.fn();
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    await expect(repository.findSummaryById('9223372036854775808')).rejects.toThrow('Invalid value for vehicleId');
    expect(query).not.toHaveBeenCalled();
  });

  it('reads only the authenticated pilot’s active assignment and maps the official view fields', async () => {
    const schema = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    expect(schema).toContain('CREATE TYPE estado_asignacion_enum AS ENUM (\'ACTIVA\',\'FINALIZADA\',\'CANCELADA\');');
    expect(schema).toContain('CREATE TABLE asignaciones_vehiculo');
    expect(schema).toContain('CREATE OR REPLACE VIEW vw_ultimo_kilometraje_vehiculo');

    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '21', placa: 'P-321', marca: 'Marca', modelo: 'Modelo', tipo: 'BRIGADA',
      estado_operativo: 'DISPONIBLE', brigada_id: '4', brigada_nombre: 'Brigada Norte',
      asignacion_id: '77', asignacion_inicio: new Date('2025-01-01T12:00:00Z'),
      kilometraje: '12500.5', kilometraje_at: new Date('2025-01-02T12:00:00Z'),
    }] });
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    await expect(repository.findActiveAssignedToUser('8')).resolves.toEqual({
      id: '21', plate: 'P-321', make: 'Marca', model: 'Modelo', kind: 'BRIGADA', operationalState: 'DISPONIBLE',
      brigade: { id: '4', name: 'Brigada Norte' },
      assignment: { id: '77', startedAt: '2025-01-01T12:00:00.000Z' },
      odometer: { value: '12500.5', recordedAt: '2025-01-02T12:00:00.000Z' },
    });
    expect(query.mock.calls[0]?.[0]).toContain("a.estado = 'ACTIVA'::gacor.estado_asignacion_enum");
    expect(query.mock.calls[0]?.[0]).toContain('a.piloto_id = $1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('v.activo = TRUE');
    expect(query.mock.calls[0]?.[1]).toEqual(['8']);
  });

  it('returns no current vehicle when there is no active assigned vehicle', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    await expect(repository.findActiveAssignedToUser('8')).resolves.toBeNull();
  });

  it('queries the official administrative availability view with stable pagination', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ vehicle_id: '9223372036854775807', plate: 'A-1', make: 'Marca', model: null, cabinet_id: '4', position_id: '8', position_number: 2, latest_odometer: '100.5' }] });
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    const pageQuery = Object.assign(new VehiclePageQueryDto(), { limit: 10, offset: 20, cabinetId: '4' });
    await expect(repository.findAdministrativeAvailable(pageQuery)).resolves.toEqual({ items: [{ id: '9223372036854775807', plate: 'A-1', make: 'Marca', model: null, cabinetId: '4', positionId: '8', positionNumber: 2, latestOdometer: '100.5' }], hasMore: false });
    expect(query.mock.calls[0]?.[0]).toContain('gacor.vw_vehiculos_administrativos_disponibles');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY vehiculo_id ASC');
    expect(query.mock.calls[0]?.[1]).toEqual(['4', 11, 20]);
  });

  it('restricts assignment history to the authenticated user and orders it stably', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    await expect(repository.findAssignmentHistoryForUser('12')).resolves.toEqual([]);
    expect(query.mock.calls[0]?.[0]).toContain('WHERE a.piloto_id = $1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY a.fecha_hora_inicio DESC, a.id DESC');
    expect(query.mock.calls[0]?.[1]).toEqual(['12']);
  });

  it('scopes maintenance status to the authenticated user active assignment and keeps NUMERIC as text', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ plan_id: '3', vehicle_id: '4', plate: 'P', maintenance_type_id: '5', maintenance: 'Aceite', current_kilometers: '100.1', last_service_kilometers: '50.0', interval_kilometers: '500.0', next_kilometers: '550.0', kilometers_remaining: '449.9', kilometer_state: 'AL_DIA' }] });
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    const result = await repository.findMaintenanceStatusForUser('8');
    expect(result[0]?.kilometersRemaining).toBe('449.9');
    expect(query.mock.calls[0]?.[0]).toContain('gacor.vw_estado_mantenimiento');
    expect(query.mock.calls[0]?.[0]).toContain("a.estado = 'ACTIVA'::gacor.estado_asignacion_enum");
    expect(query.mock.calls[0]?.[1]).toEqual(['8']);
  });

  it('validates the optional cabinet filter before querying', async () => {
    const query = vi.fn();
    const repository = new VehicleRepository({ query } as unknown as DatabaseService);
    await expect(repository.findAdministrativeAvailable(Object.assign(new VehiclePageQueryDto(), { cabinetId: '01' }))).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
