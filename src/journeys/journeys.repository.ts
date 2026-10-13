import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';

export interface JourneyRecord {
  readonly id: string;
  readonly state: string;
  readonly createdAt: string;
  readonly startObservations: string | null;
  readonly endObservations: string | null;
  readonly assignmentId: string;
  readonly movement: {
    readonly id: string;
    readonly type: string;
    readonly state: string;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly reason: string | null;
    readonly observations: string | null;
  };
  readonly vehicle: { readonly id: string; readonly plate: string; readonly make: string; readonly model: string | null };
  readonly initialOdometer: OdometerReadingSummary | null;
  readonly finalOdometer: OdometerReadingSummary | null;
}

interface OdometerReadingSummary {
  readonly id: string;
  readonly kilometers: string;
  readonly type: string;
  readonly deviceAt: string;
  readonly receivedAt: string;
}

interface JourneyRow {
  id: string;
  state: string;
  created_at: Date | string;
  start_observations: string | null;
  end_observations: string | null;
  assignment_id: string;
  movement_id: string;
  movement_type: string;
  movement_state: string;
  movement_started_at: Date | string;
  movement_ended_at: Date | string | null;
  movement_reason: string | null;
  movement_observations: string | null;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string | null;
  initial_reading_id: string | null;
  initial_kilometers: string | null;
  initial_type: string | null;
  initial_device_at: Date | string | null;
  initial_received_at: Date | string | null;
  final_reading_id: string | null;
  final_kilometers: string | null;
  final_type: string | null;
  final_device_at: Date | string | null;
  final_received_at: Date | string | null;
}

export interface JourneyHistoryResult {
  readonly items: readonly JourneyRecord[];
  readonly hasMore: boolean;
}

@Injectable()
export class JourneysRepository {
  constructor(private readonly database: DatabaseService) {}

  async findHistoryForUser(userId: string, query: JourneyHistoryQueryDto): Promise<JourneyHistoryResult> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<JourneyRow>(
      `${SELECT_JOURNEY_FIELDS}
       WHERE a.piloto_id = $1::bigint AND mv.usuario_id = $1::bigint
       ORDER BY mv.fecha_hora_inicio DESC, j.id DESC
       LIMIT $2::integer OFFSET $3::integer`,
      [userId, query.limit + 1, query.offset],
    );
    return toHistoryResult(result.rows, query.limit);
  }

  async findByIdForUser(id: string, userId: string): Promise<JourneyRecord | null> {
    assertPositiveBigintIdentifier(id, 'journeyId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<JourneyRow>(
      `${SELECT_JOURNEY_FIELDS}
       WHERE j.id = $1::bigint AND a.piloto_id = $2::bigint AND mv.usuario_id = $2::bigint`,
      [id, userId],
    );
    return result.rows[0] ? mapJourney(result.rows[0]) : null;
  }

  async findCurrentForUser(userId: string): Promise<JourneyRecord | null> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<JourneyRow>(
      `${SELECT_JOURNEY_FIELDS}
       WHERE a.piloto_id=$1::bigint AND mv.usuario_id=$1::bigint
         AND j.estado='ABIERTA'::gacor.estado_jornada_enum
         AND mv.estado='ABIERTO'::gacor.estado_movimiento_enum
       ORDER BY mv.fecha_hora_inicio DESC, j.id DESC LIMIT 1`, [userId],
    );
    return result.rows[0] ? mapJourney(result.rows[0]) : null;
  }
}

const SELECT_JOURNEY_FIELDS = `SELECT
  j.id::text AS id, j.estado::text AS state, j.created_at, j.observaciones_inicio AS start_observations,
  j.observaciones_fin AS end_observations, a.id::text AS assignment_id,
  mv.id::text AS movement_id, mv.tipo::text AS movement_type, mv.estado::text AS movement_state,
  mv.fecha_hora_inicio AS movement_started_at, mv.fecha_hora_fin AS movement_ended_at,
  mv.motivo AS movement_reason, mv.observaciones AS movement_observations,
  v.id::text AS vehicle_id, v.placa AS vehicle_plate, v.marca AS vehicle_make, v.modelo AS vehicle_model,
  li.id::text AS initial_reading_id, li.kilometraje::text AS initial_kilometers,
  li.tipo_lectura::text AS initial_type, li.fecha_hora_dispositivo AS initial_device_at,
  li.fecha_hora_servidor AS initial_received_at,
  lf.id::text AS final_reading_id, lf.kilometraje::text AS final_kilometers,
  lf.tipo_lectura::text AS final_type, lf.fecha_hora_dispositivo AS final_device_at,
  lf.fecha_hora_servidor AS final_received_at
FROM gacor.jornadas j
JOIN gacor.asignaciones_vehiculo a ON a.id = j.asignacion_id
JOIN gacor.movimientos_vehiculo mv ON mv.id = j.movimiento_id
JOIN gacor.vehiculos v ON v.id = mv.vehiculo_id AND v.id = a.vehiculo_id
LEFT JOIN gacor.lecturas_odometro li ON li.id = mv.lectura_inicio_id
  AND li.vehiculo_id = v.id AND li.usuario_id = mv.usuario_id
LEFT JOIN gacor.lecturas_odometro lf ON lf.id = mv.lectura_fin_id
  AND lf.vehiculo_id = v.id AND lf.usuario_id = mv.usuario_id`;

function toHistoryResult(rows: readonly JourneyRow[], limit: number): JourneyHistoryResult {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { items: page.map(mapJourney), hasMore };
}

function mapJourney(row: JourneyRow): JourneyRecord {
  return {
    id: row.id,
    state: row.state,
    createdAt: toIso(row.created_at),
    startObservations: row.start_observations,
    endObservations: row.end_observations,
    assignmentId: row.assignment_id,
    movement: {
      id: row.movement_id,
      type: row.movement_type,
      state: row.movement_state,
      startedAt: toIso(row.movement_started_at),
      endedAt: row.movement_ended_at === null ? null : toIso(row.movement_ended_at),
      reason: row.movement_reason,
      observations: row.movement_observations,
    },
    vehicle: { id: row.vehicle_id, plate: row.vehicle_plate, make: row.vehicle_make, model: row.vehicle_model },
    initialOdometer: mapReading(row.initial_reading_id, row.initial_kilometers, row.initial_type, row.initial_device_at, row.initial_received_at),
    finalOdometer: mapReading(row.final_reading_id, row.final_kilometers, row.final_type, row.final_device_at, row.final_received_at),
  };
}

function mapReading(
  id: string | null,
  kilometers: string | null,
  type: string | null,
  deviceAt: Date | string | null,
  receivedAt: Date | string | null,
): OdometerReadingSummary | null {
  if (id === null || kilometers === null || type === null || deviceAt === null || receivedAt === null) return null;
  return { id, kilometers, type, deviceAt: toIso(deviceAt), receivedAt: toIso(receivedAt) };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
