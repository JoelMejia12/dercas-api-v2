import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { MovementHistoryQueryDto } from './movement-query.dto';

export type MovementScope = 'assigned' | 'administrative';
export interface MovementItem {
  readonly id: string; readonly vehicle: { readonly id: string; readonly plate: string };
  readonly type: string; readonly state: string; readonly startedAt: string; readonly endedAt: string | null;
  readonly startOdometer: { readonly id: string; readonly kilometers: string } | null;
  readonly endOdometer: { readonly id: string; readonly kilometers: string } | null;
  readonly journeyId: string | null; readonly loanId: string | null;
}
export interface MovementPageData { readonly items: readonly MovementItem[]; readonly hasMore: boolean }
interface MovementRow {
  id: string; vehicle_id: string; vehicle_plate: string; type: string; state: string;
  started_at: Date | string; ended_at: Date | string | null;
  start_reading_id: string | null; start_kilometers: string | null;
  end_reading_id: string | null; end_kilometers: string | null;
  journey_id: string | null; loan_id: string | null;
}

@Injectable()
export class MovementsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findHistory(userId: string, scope: MovementScope, query: MovementHistoryQueryDto): Promise<MovementPageData> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const relation = scope === 'assigned'
      ? `mv.tipo = 'JORNADA_BRIGADA'::gacor.tipo_movimiento_enum AND EXISTS (
           SELECT 1 FROM gacor.jornadas j JOIN gacor.asignaciones_vehiculo a ON a.id=j.asignacion_id
           WHERE j.movimiento_id=mv.id AND a.piloto_id=$1::bigint)`
      : `mv.tipo = 'PRESTAMO_ADMINISTRATIVO'::gacor.tipo_movimiento_enum AND EXISTS (
           SELECT 1 FROM gacor.prestamos_administrativos p WHERE p.movimiento_id=mv.id AND p.usuario_id=$1::bigint)`;
    const result = await this.database.query<MovementRow>(
      `${SELECT_MOVEMENT_FIELDS} WHERE mv.usuario_id=$1::bigint AND ${relation}
       ORDER BY mv.fecha_hora_inicio DESC, mv.id DESC LIMIT $2::integer OFFSET $3::integer`,
      [userId, query.limit + 1, query.offset],
    );
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapMovement), hasMore };
  }

  async findOpen(userId: string, scope: MovementScope): Promise<MovementItem | null> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const relation = scope === 'assigned'
      ? `mv.tipo = 'JORNADA_BRIGADA'::gacor.tipo_movimiento_enum AND EXISTS (
           SELECT 1 FROM gacor.jornadas j JOIN gacor.asignaciones_vehiculo a ON a.id=j.asignacion_id
           WHERE j.movimiento_id=mv.id AND a.piloto_id=$1::bigint AND j.estado='ABIERTA')`
      : `mv.tipo = 'PRESTAMO_ADMINISTRATIVO'::gacor.tipo_movimiento_enum AND EXISTS (
           SELECT 1 FROM gacor.prestamos_administrativos p WHERE p.movimiento_id=mv.id AND p.usuario_id=$1::bigint
             AND p.estado NOT IN ('FINALIZADO','CANCELADO'))`;
    const result = await this.database.query<MovementRow>(
      `${SELECT_MOVEMENT_FIELDS} WHERE mv.usuario_id=$1::bigint AND mv.estado='ABIERTO'::gacor.estado_movimiento_enum
       AND ${relation} ORDER BY mv.fecha_hora_inicio DESC, mv.id DESC LIMIT 1`, [userId],
    );
    return result.rows[0] ? mapMovement(result.rows[0]) : null;
  }

  async findById(userId: string, id: string, scope: MovementScope): Promise<MovementItem | null> {
    assertPositiveBigintIdentifier(userId, 'userId');
    assertPositiveBigintIdentifier(id, 'movementId');
    const relation = scope === 'assigned'
      ? `mv.tipo = 'JORNADA_BRIGADA'::gacor.tipo_movimiento_enum AND EXISTS (
           SELECT 1 FROM gacor.jornadas j JOIN gacor.asignaciones_vehiculo a ON a.id=j.asignacion_id
           WHERE j.movimiento_id=mv.id AND a.piloto_id=$1::bigint)`
      : `mv.tipo = 'PRESTAMO_ADMINISTRATIVO'::gacor.tipo_movimiento_enum AND EXISTS (
           SELECT 1 FROM gacor.prestamos_administrativos p WHERE p.movimiento_id=mv.id AND p.usuario_id=$1::bigint)`;
    const result = await this.database.query<MovementRow>(
      `${SELECT_MOVEMENT_FIELDS} WHERE mv.usuario_id=$1::bigint AND mv.id=$2::bigint AND ${relation}`,
      [userId, id],
    );
    return result.rows[0] ? mapMovement(result.rows[0]) : null;
  }
}

const SELECT_MOVEMENT_FIELDS = `SELECT mv.id::text AS id, v.id::text AS vehicle_id, v.placa AS vehicle_plate,
       mv.tipo::text AS type, mv.estado::text AS state, mv.fecha_hora_inicio AS started_at,
       mv.fecha_hora_fin AS ended_at, li.id::text AS start_reading_id, li.kilometraje::text AS start_kilometers,
       lf.id::text AS end_reading_id, lf.kilometraje::text AS end_kilometers,
       j.id::text AS journey_id, p.id::text AS loan_id
       FROM gacor.movimientos_vehiculo mv JOIN gacor.vehiculos v ON v.id=mv.vehiculo_id
       LEFT JOIN gacor.lecturas_odometro li ON li.id=mv.lectura_inicio_id
       LEFT JOIN gacor.lecturas_odometro lf ON lf.id=mv.lectura_fin_id
       LEFT JOIN gacor.jornadas j ON j.movimiento_id=mv.id
       LEFT JOIN gacor.prestamos_administrativos p ON p.movimiento_id=mv.id`;

function mapMovement(row: MovementRow): MovementItem {
  return {
    id: row.id, vehicle: { id: row.vehicle_id, plate: row.vehicle_plate }, type: row.type, state: row.state,
    startedAt: toIso(row.started_at), endedAt: row.ended_at ? toIso(row.ended_at) : null,
    startOdometer: row.start_reading_id === null ? null : { id: row.start_reading_id, kilometers: row.start_kilometers! },
    endOdometer: row.end_reading_id === null ? null : { id: row.end_reading_id, kilometers: row.end_kilometers! },
    journeyId: row.journey_id, loanId: row.loan_id,
  };
}
function toIso(value: Date | string): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
