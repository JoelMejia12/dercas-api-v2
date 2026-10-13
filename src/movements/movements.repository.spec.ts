import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { MovementHistoryQueryDto } from './movement-query.dto';
import { MovementsRepository } from './movements.repository';

const sample = {
  id: '9223372036854775000', vehicle_id: '55', vehicle_plate: 'ABC-123', type: 'JORNADA_BRIGADA', state: 'ABIERTO',
  started_at: new Date('2026-05-01T08:00:00Z'), ended_at: null,
  start_reading_id: '100', start_kilometers: '12345.6', end_reading_id: null, end_kilometers: null,
  journey_id: '7', loan_id: null,
};

describe('MovementsRepository', () => {
  it('limits assigned movement history to journeys tied to the principal user assignment', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [sample] });
    const repo = new MovementsRepository({ query } as unknown as DatabaseService);
    const result = await repo.findHistory('8', 'assigned', Object.assign(new MovementHistoryQueryDto(), { limit: 1, offset: 2 }));
    expect(result.items[0]).toMatchObject({ id: sample.id, startOdometer: { kilometers: '12345.6' }, journeyId: '7' });
    expect(result.hasMore).toBe(false);
    expect(query.mock.calls[0]?.[0]).toContain('JOIN gacor.asignaciones_vehiculo a ON a.id=j.asignacion_id');
    expect(query.mock.calls[0]?.[0]).toContain('a.piloto_id=$1::bigint');
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY mv.fecha_hora_inicio DESC, mv.id DESC');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', 2, 2]);
  });

  it('limits administrative movement history to the caller’s own linked loans', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = new MovementsRepository({ query } as unknown as DatabaseService);
    await expect(repo.findHistory('8', 'administrative', new MovementHistoryQueryDto())).resolves.toEqual({ items: [], hasMore: false });
    expect(query.mock.calls[0]?.[0]).toContain('p.movimiento_id=mv.id AND p.usuario_id=$1::bigint');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', 26, 0]);
  });

  it('returns only a linked, open movement in the requested scope', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [sample] });
    const repo = new MovementsRepository({ query } as unknown as DatabaseService);
    await repo.findOpen('8', 'assigned');
    expect(query.mock.calls[0]?.[0]).toContain("mv.estado='ABIERTO'::gacor.estado_movimiento_enum");
    expect(query.mock.calls[0]?.[0]).toContain("j.estado='ABIERTA'");
    expect(query.mock.calls[0]?.[1]).toEqual(['8']);
  });

  it('scopes a detail lookup by owner and source relationship', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new MovementsRepository({ query } as unknown as DatabaseService).findById('8', '99', 'administrative');
    expect(query.mock.calls[0]?.[0]).toContain('mv.usuario_id=$1::bigint AND mv.id=$2::bigint');
    expect(query.mock.calls[0]?.[1]).toEqual(['8', '99']);
  });
});
