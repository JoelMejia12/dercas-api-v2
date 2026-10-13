import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service';
import { NotificationListQueryDto } from './notification.dto';
import { NotificationsRepository } from './notifications.repository';

const row = {
  id: '9007199254740993', channel: 'APP', state: 'LEIDA', created_at: new Date('2026-10-01T10:00:00Z'),
  sent_at: null, delivered_at: null, read_at: new Date('2026-10-01T10:01:00Z'), alert_id: '22',
  alert_type: 'GPS_OFFLINE', alert_priority: 'MEDIA', alert_title: 'Dispositivo sin señal', alert_message: 'Sin heartbeat reciente',
  alert_state: 'PENDIENTE', vehicle_id: '14', alert_created_at: new Date('2026-10-01T09:59:00Z'), resolved_at: null,
};

describe('NotificationsRepository', () => {
  it('returns recipient notifications with safe alert details and stable pagination', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new NotificationsRepository({ query } as unknown as DatabaseService);
    const dto = Object.assign(new NotificationListQueryDto(), { limit: 3, offset: 9, state: 'LEIDA', channel: 'APP' });
    await expect(repository.findForRecipient('8', dto)).resolves.toMatchObject({
      items: [{ id: row.id, state: 'LEIDA', alert: { id: '22', title: 'Dispositivo sin señal' } }], hasMore: false,
    });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM gacor.notificaciones n JOIN gacor.alertas a ON a.id=n.alerta_id');
    expect(sql).toContain('WHERE n.destinatario_id=$1::bigint');
    expect(sql).toContain('ORDER BY n.created_at DESC, n.id DESC');
    expect(values).toEqual(['8', 'LEIDA', 'APP', 4, 9]);
  });

  it('returns empty recipient inbox and hides another recipient’s notification', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new NotificationsRepository({ query } as unknown as DatabaseService);
    await expect(repository.findForRecipient('8', new NotificationListQueryDto())).resolves.toEqual({ items: [], hasMore: false });
    await expect(repository.findByIdForRecipient('5', '8')).resolves.toBeNull();
    expect(query.mock.calls[1]?.[0]).toContain('WHERE n.id=$1::bigint AND n.destinatario_id=$2::bigint');
    expect(query.mock.calls[1]?.[1]).toEqual(['5', '8']);
  });

  it('rejects invalid BIGINT identity before querying', async () => {
    const query = vi.fn();
    await expect(new NotificationsRepository({ query } as unknown as DatabaseService)
      .findByIdForRecipient('1.2', '8')).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
