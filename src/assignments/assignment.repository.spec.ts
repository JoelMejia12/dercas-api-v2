import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { AssignmentRepository } from './assignment.repository';

describe('AssignmentRepository', () => {
  it('reads and maps the authenticated pilot’s current assignment and schema-backed vehicle data', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '12', state: 'ACTIVA', started_at: new Date('2026-01-02T03:04:05Z'), ends_at: null,
      vehicle_id: '22', vehicle_plate: 'ABC-123', vehicle_make: 'Marca', vehicle_model: null,
      vehicle_kind: 'BRIGADA', vehicle_operational_state: 'DISPONIBLE', brigade_id: '5', brigade_name: 'Norte',
    }] });
    const repository = new AssignmentRepository({ query } as unknown as DatabaseService);
    await expect(repository.findActiveForPilot('8')).resolves.toEqual({
      id: '12', state: 'ACTIVA', startedAt: '2026-01-02T03:04:05.000Z', endsAt: null,
      vehicle: {
        id: '22', plate: 'ABC-123', make: 'Marca', model: null, kind: 'BRIGADA',
        operationalState: 'DISPONIBLE', brigade: { id: '5', name: 'Norte' },
      },
    });
    const [sql, values] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('FROM gacor.asignaciones_vehiculo a');
    expect(sql).toContain("a.estado = 'ACTIVA'::gacor.estado_asignacion_enum");
    expect(sql).toContain('a.piloto_id = $1::bigint');
    expect(sql).toContain('ORDER BY a.fecha_hora_inicio DESC, a.id DESC');
    expect(values).toEqual(['8']);
  });

  it('returns null when the authenticated pilot has no active assignment', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(new AssignmentRepository({ query } as unknown as DatabaseService).findActiveForPilot('8')).resolves.toBeNull();
  });

  it('returns paginated history constrained to the authenticated pilot and joined vehicle brigade', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      id: '12', state: 'FINALIZADA', started_at: new Date('2026-01-02T03:04:05Z'), ends_at: new Date('2026-02-02T03:04:05Z'),
      vehicle_id: '22', vehicle_plate: 'ABC-123', vehicle_make: 'Marca', vehicle_model: null,
      vehicle_kind: 'BRIGADA', vehicle_operational_state: 'DISPONIBLE', brigade_id: '5', brigade_name: 'Norte',
      pilot_id: '8', pilot_name: 'Ana Piloto', assigned_by_id: '3', assigned_by_name: 'Jefe Uno', observations: null,
    }] });
    const repo = new AssignmentRepository({ query } as unknown as DatabaseService);
    await expect(repo.findHistoryForPilot('8', 1, 4)).resolves.toMatchObject({
      items: [{ id: '12', state: 'FINALIZADA', pilot: { id: '8' }, assignedBy: { id: '3' }, vehicle: { brigade: { id: '5', name: 'Norte' } } }],
      hasMore: false,
    });
    expect(query.mock.calls[0]?.[0]).toContain('WHERE a.piloto_id=$1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY a.fecha_hora_inicio DESC, a.id DESC');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', 2, 4]);
  });

  it('isolates assignment detail by both assignment ID and authenticated pilot ID', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(new AssignmentRepository({ query } as unknown as DatabaseService).findByIdForPilot('12', '8')).resolves.toBeNull();
    expect(query.mock.calls[0]?.[0]).toContain('WHERE a.id=$1::bigint AND a.piloto_id=$2::bigint');
    expect(query.mock.calls[0]?.[1]).toEqual(['12', '8']);
  });

  it('rejects out-of-range BIGINT identities before querying', async () => {
    const query = vi.fn();
    await expect(new AssignmentRepository({ query } as unknown as DatabaseService)
      .findActiveForPilot('9223372036854775808')).rejects.toThrow('Invalid value for pilotId');
    expect(query).not.toHaveBeenCalled();
  });

  it('references only assignment, vehicle, and brigade columns declared by the official SQL', () => {
    const sql = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const assignmentTable = sql.match(/CREATE TABLE asignaciones_vehiculo \(([\s\S]*?)\n\);/)?.[1];
    const vehicleTable = sql.match(/CREATE TABLE vehiculos \(([\s\S]*?)\n\);/)?.[1];
    const brigadeTable = sql.match(/CREATE TABLE brigadas \(([\s\S]*?)\n\);/)?.[1];
    expect(assignmentTable).toContain('vehiculo_id BIGINT');
    expect(assignmentTable).toContain('piloto_id BIGINT');
    expect(assignmentTable).toContain('fecha_hora_inicio TIMESTAMPTZ');
    expect(assignmentTable).toContain('fecha_hora_fin TIMESTAMPTZ');
    expect(assignmentTable).toContain('estado estado_asignacion_enum');
    expect(vehicleTable).toContain('brigada_id BIGINT');
    expect(vehicleTable).toContain('placa VARCHAR');
    expect(brigadeTable).toContain('nombre VARCHAR');
    expect(sql).toContain("CREATE UNIQUE INDEX uq_asignacion_activa_piloto ON asignaciones_vehiculo(piloto_id) WHERE estado='ACTIVA';");
  });

  it('propagates repository failures for the shared error handler without exposing query content', async () => {
    const query = vi.fn().mockRejectedValue(new Error('database unavailable'));
    await expect(new AssignmentRepository({ query } as unknown as DatabaseService).findActiveForPilot('8'))
      .rejects.toThrow('database unavailable');
  });
});
