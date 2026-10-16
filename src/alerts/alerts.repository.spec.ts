import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { AlertHistoryQueryDto } from './alerts.dto';
import { AlertsRepository } from './alerts.repository';

const row = {
  notification_id: '71', alert_id: '50', channel: 'APP', notification_state: 'PENDIENTE', sent_at: null,
  delivered_at: null, read_at: null, notification_created_at: new Date('2026-01-01T00:00:00Z'), type: 'PANICO',
  priority: 'MEDIA', vehicle_id: '10', title: 'Alerta', message: 'Mensaje', alert_state: 'PENDIENTE',
  alert_created_at: new Date('2026-01-01T00:00:00Z'), resolved_at: null,
};

describe('AlertsRepository', () => {
  it('returns scoped alerts with stable pagination and actual filter columns', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new AlertsRepository({ query } as unknown as DatabaseService);
    const dto = Object.assign(new AlertHistoryQueryDto(), { alertState: 'PENDIENTE', notificationState: 'PENDIENTE', channel: 'APP', limit: 10, offset: 5 });
    await expect(repository.findForUser('8', true, dto)).resolves.toMatchObject({ items: [{ alertId: '50', type: 'PANICO' }], hasMore: false });
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('n.destinatario_id = $1::bigint');
    expect(sql).not.toContain('SELECT n.*');
    expect(sql).toContain('SELECT n.id, n.alerta_id, n.destinatario_id, n.canal, n.estado');
    expect(sql).toContain('a.usuario_id = $1::bigint');
    expect(sql).toContain('av.piloto_id = $1::bigint');
    expect(sql).toContain("av.estado = 'ACTIVA'::gacor.estado_asignacion_enum");
    expect(sql).toContain('ORDER BY a.created_at DESC, a.id DESC');
    expect(params).toEqual(['8', true, 'PENDIENTE', 'PENDIENTE', 'APP', 11, 5]);
  });

  it('restricts alert detail to own notification, direct user alert, or authorized active assignment', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new AlertsRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('50', '8', false)).resolves.toBeNull();
    expect(query.mock.calls[0]![0]).toContain('a.id = $1::bigint');
    expect(query.mock.calls[0]![0]).toContain('n.destinatario_id = $2::bigint');
    expect(query.mock.calls[0]![0]).not.toContain('SELECT n.*');
    expect(query.mock.calls[0]![1]).toEqual(['50', '8', false]);
  });

  it('rejects invalid identifiers without querying', async () => {
    const query = vi.fn();
    const repository = new AlertsRepository({ query } as unknown as DatabaseService);
    await expect(repository.findByIdForUser('00', '8', false)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
