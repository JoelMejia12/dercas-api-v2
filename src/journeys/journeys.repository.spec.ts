import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';
import { JourneysRepository } from './journeys.repository';

function journeyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '12', state: 'FINALIZADA', created_at: new Date('2026-07-01T09:00:00Z'), start_observations: null,
    end_observations: 'Fin de jornada', assignment_id: '6', movement_id: '8', movement_type: 'JORNADA_BRIGADA',
    movement_state: 'FINALIZADO', movement_started_at: new Date('2026-07-01T08:00:00Z'),
    movement_ended_at: new Date('2026-07-01T17:00:00Z'), movement_reason: null, movement_observations: null,
    vehicle_id: '22', vehicle_plate: 'ABC-123', vehicle_make: 'Marca', vehicle_model: 'Modelo',
    initial_reading_id: '31', initial_kilometers: '12345.0', initial_type: 'JORNADA_INICIO',
    initial_device_at: new Date('2026-07-01T08:00:00Z'), initial_received_at: new Date('2026-07-01T08:01:00Z'),
    final_reading_id: '32', final_kilometers: '12400.5', final_type: 'JORNADA_FIN',
    final_device_at: new Date('2026-07-01T17:00:00Z'), final_received_at: new Date('2026-07-01T17:01:00Z'),
    ...overrides,
  };
}

describe('JourneysRepository', () => {
  it('maps a personal journey with its related movement, vehicle, and odometer readings', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [journeyRow()] });
    const repository = new JourneysRepository({ query } as unknown as DatabaseService);
    const result = await repository.findHistoryForUser('8', Object.assign(new JourneyHistoryQueryDto(), { limit: 25, offset: 0 }));
    expect(result.items[0]).toMatchObject({
      id: '12', state: 'FINALIZADA', assignmentId: '6',
      movement: { id: '8', type: 'JORNADA_BRIGADA', state: 'FINALIZADO' },
      vehicle: { id: '22', plate: 'ABC-123' },
      initialOdometer: { id: '31', kilometers: '12345.0', type: 'JORNADA_INICIO' },
      finalOdometer: { id: '32', kilometers: '12400.5', type: 'JORNADA_FIN' },
    });
    expect(query.mock.calls[0]?.[0]).toContain('a.piloto_id = $1::bigint AND mv.usuario_id = $1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY mv.fecha_hora_inicio DESC, j.id DESC');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', 26, 0]);
  });

  it('returns empty history and reports pagination exhaustion', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(new JourneysRepository({ query } as unknown as DatabaseService)
      .findHistoryForUser('8', new JourneyHistoryQueryDto())).resolves.toEqual({ items: [], hasMore: false });
  });

  it('identifies the current journey only when both journey and movement remain open', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [journeyRow({ state: 'ABIERTA', movement_state: 'ABIERTO', movement_ended_at: null })] });
    const repository = new JourneysRepository({ query } as unknown as DatabaseService);
    await expect(repository.findCurrentForUser('8')).resolves.toMatchObject({ id: '12', state: 'ABIERTA', movement: { state: 'ABIERTO' } });
    expect(query.mock.calls[0]?.[0]).toContain("j.estado='ABIERTA'::gacor.estado_jornada_enum");
    expect(query.mock.calls[0]?.[0]).toContain("mv.estado='ABIERTO'::gacor.estado_movimiento_enum");
    expect(query.mock.calls[0]?.[1]).toEqual(['8']);
  });

  it('returns null for missing/non-owned details and rejects invalid IDs', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new JourneysRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('12', '8')).resolves.toBeNull();
    await expect(repository.findByIdForUser('9223372036854775808', '8')).rejects.toThrow('Invalid value for journeyId');
    expect(query).toHaveBeenCalledOnce();
  });

  it('propagates repository errors and validates official relation names', async () => {
    const query = vi.fn().mockRejectedValue(new Error('database error'));
    await expect(new JourneysRepository({ query } as unknown as DatabaseService)
      .findHistoryForUser('8', new JourneyHistoryQueryDto())).rejects.toThrow('database error');
    const schema = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    expect(schema).toContain('CREATE TABLE jornadas');
    expect(schema).toContain('asignacion_id BIGINT NOT NULL REFERENCES asignaciones_vehiculo(id)');
    expect(schema).toContain('movimiento_id BIGINT NOT NULL UNIQUE REFERENCES movimientos_vehiculo(id)');
    expect(schema).toContain('CREATE TYPE estado_jornada_enum AS ENUM (\'ABIERTA\',\'FINALIZADA\',\'ANULADA\');');
    expect(schema).toContain('CREATE TYPE estado_movimiento_enum AS ENUM (\'ABIERTO\',\'FINALIZADO\',\'CANCELADO\');');
  });
});
