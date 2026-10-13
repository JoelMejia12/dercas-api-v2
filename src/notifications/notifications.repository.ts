import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { NotificationListQueryDto } from './notification.dto';

export interface NotificationItem {
  readonly id: string; readonly channel: string; readonly state: string;
  readonly createdAt: string; readonly sentAt: string | null; readonly deliveredAt: string | null; readonly readAt: string | null;
  readonly alert: { readonly id: string; readonly type: string; readonly priority: string; readonly title: string; readonly message: string; readonly state: string; readonly vehicleId: string | null; readonly createdAt: string; readonly resolvedAt: string | null };
}
export interface NotificationPage { readonly items: readonly NotificationItem[]; readonly hasMore: boolean }
interface NotificationRow {
  id: string; channel: string; state: string; created_at: Date | string;
  sent_at: Date | string | null; delivered_at: Date | string | null; read_at: Date | string | null;
  alert_id: string; alert_type: string; alert_priority: string; alert_title: string; alert_message: string;
  alert_state: string; vehicle_id: string | null; alert_created_at: Date | string; resolved_at: Date | string | null;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findForRecipient(userId: string, query: NotificationListQueryDto): Promise<NotificationPage> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<NotificationRow>(
      `${SELECT_NOTIFICATION_FIELDS}
       WHERE n.destinatario_id=$1::bigint
         AND ($2::text IS NULL OR n.estado::text=$2::text)
         AND ($3::text IS NULL OR n.canal::text=$3::text)
       ORDER BY n.created_at DESC, n.id DESC LIMIT $4::integer OFFSET $5::integer`,
      [userId, query.state ?? null, query.channel ?? null, query.limit + 1, query.offset],
    );
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapNotification), hasMore };
  }

  async findByIdForRecipient(id: string, userId: string): Promise<NotificationItem | null> {
    assertPositiveBigintIdentifier(id, 'notificationId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<NotificationRow>(
      `${SELECT_NOTIFICATION_FIELDS} WHERE n.id=$1::bigint AND n.destinatario_id=$2::bigint`, [id, userId],
    );
    return result.rows[0] ? mapNotification(result.rows[0]) : null;
  }
}

const SELECT_NOTIFICATION_FIELDS = `SELECT n.id::text AS id, n.canal::text AS channel, n.estado::text AS state,
       n.created_at, n.fecha_envio AS sent_at, n.fecha_entrega AS delivered_at, n.fecha_lectura AS read_at,
       a.id::text AS alert_id, a.tipo AS alert_type, a.prioridad::text AS alert_priority,
       a.titulo AS alert_title, a.mensaje AS alert_message, a.estado::text AS alert_state,
       a.vehiculo_id::text AS vehicle_id, a.created_at AS alert_created_at, a.resolved_at
       FROM gacor.notificaciones n JOIN gacor.alertas a ON a.id=n.alerta_id`;

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id, channel: row.channel, state: row.state, createdAt: toIso(row.created_at),
    sentAt: nullableIso(row.sent_at), deliveredAt: nullableIso(row.delivered_at), readAt: nullableIso(row.read_at),
    alert: {
      id: row.alert_id, type: row.alert_type, priority: row.alert_priority, title: row.alert_title,
      message: row.alert_message, state: row.alert_state, vehicleId: row.vehicle_id,
      createdAt: toIso(row.alert_created_at), resolvedAt: nullableIso(row.resolved_at),
    },
  };
}
function toIso(value: Date | string): string { return new Date(value).toISOString(); }
function nullableIso(value: Date | string | null): string | null { return value === null ? null : toIso(value); }
