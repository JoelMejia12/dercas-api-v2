import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { AlertHistoryQueryDto } from './alerts.dto';

export interface AlertNotificationRecord {
  readonly notificationId: string | null;
  readonly alertId: string;
  readonly channel: string | null;
  readonly notificationState: string | null;
  readonly sentAt: string | null;
  readonly deliveredAt: string | null;
  readonly readAt: string | null;
  readonly notificationCreatedAt: string | null;
  readonly type: string;
  readonly priority: string;
  readonly vehicleId: string | null;
  readonly title: string;
  readonly message: string;
  readonly alertState: string;
  readonly alertCreatedAt: string;
  readonly resolvedAt: string | null;
}

interface AlertRow { notification_id: string | null; alert_id: string; channel: string | null; notification_state: string | null; sent_at: Date | string | null; delivered_at: Date | string | null; read_at: Date | string | null; notification_created_at: Date | string | null; type: string; priority: string; vehicle_id: string | null; title: string; message: string; alert_state: string; alert_created_at: Date | string; resolved_at: Date | string | null }

@Injectable()
export class AlertsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findForUser(userId: string, includeAssignedVehicleAlerts: boolean, query: AlertHistoryQueryDto): Promise<{ items: readonly AlertNotificationRecord[]; hasMore: boolean }> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<AlertRow>(
      `${SELECT_ALERT_FIELDS}
       FROM gacor.alertas a
       LEFT JOIN LATERAL (SELECT n.* FROM gacor.notificaciones n
         WHERE n.alerta_id = a.id AND n.destinatario_id = $1::bigint
         ORDER BY n.created_at DESC, n.id DESC LIMIT 1) n ON TRUE
       WHERE (n.id IS NOT NULL OR a.usuario_id = $1::bigint OR
         ($2::boolean AND EXISTS (SELECT 1 FROM gacor.asignaciones_vehiculo av
           WHERE av.piloto_id = $1::bigint AND av.vehiculo_id = a.vehiculo_id
             AND av.estado = 'ACTIVA'::gacor.estado_asignacion_enum)))
         AND ($3::text IS NULL OR a.estado::text = $3::text)
         AND ($4::text IS NULL OR n.estado::text = $4::text)
         AND ($5::text IS NULL OR n.canal::text = $5::text)
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $6::integer OFFSET $7::integer`,
      [userId, includeAssignedVehicleAlerts, query.alertState ?? null, query.notificationState ?? null, query.channel ?? null, query.limit + 1, query.offset],
    );
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapAlert), hasMore };
  }

  async findByIdForUser(id: string, userId: string, includeAssignedVehicleAlerts: boolean): Promise<AlertNotificationRecord | null> {
    assertPositiveBigintIdentifier(id, 'alertId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<AlertRow>(
      `${SELECT_ALERT_FIELDS}
       FROM gacor.alertas a
       LEFT JOIN LATERAL (SELECT n.* FROM gacor.notificaciones n
         WHERE n.alerta_id = a.id AND n.destinatario_id = $2::bigint
         ORDER BY n.created_at DESC, n.id DESC LIMIT 1) n ON TRUE
       WHERE a.id = $1::bigint AND (n.id IS NOT NULL OR a.usuario_id = $2::bigint OR
         ($3::boolean AND EXISTS (SELECT 1 FROM gacor.asignaciones_vehiculo av
           WHERE av.piloto_id = $2::bigint AND av.vehiculo_id = a.vehiculo_id
             AND av.estado = 'ACTIVA'::gacor.estado_asignacion_enum)))`, [id, userId, includeAssignedVehicleAlerts]);
    return result.rows[0] ? mapAlert(result.rows[0]) : null;
  }
}

const SELECT_ALERT_FIELDS = `SELECT n.id::text AS notification_id, a.id::text AS alert_id,
  n.canal::text AS channel, n.estado::text AS notification_state, n.fecha_envio AS sent_at,
  n.fecha_entrega AS delivered_at, n.fecha_lectura AS read_at, n.created_at AS notification_created_at,
  a.tipo AS type, a.prioridad::text AS priority, a.vehiculo_id::text AS vehicle_id,
  a.titulo AS title, a.mensaje AS message, a.estado::text AS alert_state,
  a.created_at AS alert_created_at, a.resolved_at`;

function mapAlert(row: AlertRow): AlertNotificationRecord {
  return { notificationId: row.notification_id, alertId: row.alert_id, channel: row.channel,
    notificationState: row.notification_state, sentAt: nullableIso(row.sent_at), deliveredAt: nullableIso(row.delivered_at),
    readAt: nullableIso(row.read_at), notificationCreatedAt: row.notification_created_at === null ? null : toIso(row.notification_created_at), type: row.type,
    priority: row.priority, vehicleId: row.vehicle_id, title: row.title, message: row.message,
    alertState: row.alert_state, alertCreatedAt: toIso(row.alert_created_at), resolvedAt: nullableIso(row.resolved_at) };
}
function toIso(value: Date | string): string { return new Date(value).toISOString(); }
function nullableIso(value: Date | string | null): string | null { return value === null ? null : toIso(value); }
