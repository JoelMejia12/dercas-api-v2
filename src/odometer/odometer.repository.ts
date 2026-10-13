import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { OdometerHistoryQueryDto } from './odometer-history-query.dto';

export interface OdometerHistoryItem {
  readonly id: string;
  readonly vehicle: { readonly id: string; readonly plate: string };
  readonly kilometers: string;
  readonly type: string;
  readonly deviceAt: string;
  readonly receivedAt: string;
  readonly photoUrl: string | null;
  readonly suggestedValue: string | null;
  readonly differenceReason: string | null;
  readonly isValid: boolean;
}

export interface OdometerHistoryResult {
  readonly items: readonly OdometerHistoryItem[];
  readonly hasMore: boolean;
}

interface OdometerRow {
  id: string;
  vehicle_id: string;
  vehicle_plate: string;
  kilometers: string;
  type: string;
  device_at: Date | string;
  received_at: Date | string;
  photo_url: string | null;
  suggested_value: string | null;
  difference_reason: string | null;
  is_valid: boolean;
}

@Injectable()
export class OdometerRepository {
  constructor(private readonly database: DatabaseService) {}

  async findHistoryForUser(userId: string, query: OdometerHistoryQueryDto): Promise<OdometerHistoryResult> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<OdometerRow>(
      `SELECT lo.id::text AS id, v.id::text AS vehicle_id, v.placa AS vehicle_plate,
              lo.kilometraje::text AS kilometers, lo.tipo_lectura::text AS type,
              lo.fecha_hora_dispositivo AS device_at, lo.fecha_hora_servidor AS received_at,
              lo.foto_url AS photo_url, lo.valor_sugerido::text AS suggested_value,
              lo.motivo_diferencia AS difference_reason, lo.es_valida AS is_valid
       FROM gacor.lecturas_odometro lo
       JOIN gacor.vehiculos v ON v.id = lo.vehiculo_id
       WHERE lo.usuario_id = $1::bigint
       ORDER BY lo.fecha_hora_servidor DESC, lo.id DESC
       LIMIT $2::integer OFFSET $3::integer`,
      [userId, query.limit + 1, query.offset],
    );
    const hasMore = result.rows.length > query.limit;
    const rows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    return { items: rows.map(mapOdometerRow), hasMore };
  }

  async findByIdForUser(id: string, userId: string): Promise<OdometerHistoryItem | null> {
    assertPositiveBigintIdentifier(id, 'odometerId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<OdometerRow>(
      `SELECT lo.id::text AS id, v.id::text AS vehicle_id, v.placa AS vehicle_plate,
              lo.kilometraje::text AS kilometers, lo.tipo_lectura::text AS type,
              lo.fecha_hora_dispositivo AS device_at, lo.fecha_hora_servidor AS received_at,
              lo.foto_url AS photo_url, lo.valor_sugerido::text AS suggested_value,
              lo.motivo_diferencia AS difference_reason, lo.es_valida AS is_valid
       FROM gacor.lecturas_odometro lo JOIN gacor.vehiculos v ON v.id = lo.vehiculo_id
       WHERE lo.id = $1::bigint AND lo.usuario_id = $2::bigint`, [id, userId],
    );
    return result.rows[0] ? mapOdometerRow(result.rows[0]) : null;
  }
}

function mapOdometerRow(row: OdometerRow): OdometerHistoryItem {
  return {
    id: row.id,
    vehicle: { id: row.vehicle_id, plate: row.vehicle_plate },
    kilometers: row.kilometers,
    type: row.type,
    deviceAt: toIso(row.device_at),
    receivedAt: toIso(row.received_at),
    photoUrl: row.photo_url,
    suggestedValue: row.suggested_value,
    differenceReason: row.difference_reason,
    isValid: row.is_valid,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
