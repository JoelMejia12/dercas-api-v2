import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { DatabaseService } from '../database/database.service';
import { PgQueryable } from '../database/pg-queryable';
import { assertPositiveBigintIdentifier, assertUuid } from '../database/postgres-values';
import { JourneyHistoryQueryDto } from './journey-history-query.dto';

export interface CreateJourneyInput {
  readonly userId: string;
  readonly operationId: string;
  readonly kilometers: string;
  readonly deviceAt: string;
  readonly observations?: string;
  readonly auditIp: string;
}

export interface FinishJourneyInput extends CreateJourneyInput {
  readonly journeyId: string;
}

export class JourneyNoActiveAssignmentError extends Error {}
export class JourneyConflictError extends Error {}
export class JourneyIdempotencyConflictError extends Error {}

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

  async start(input: CreateJourneyInput): Promise<JourneyRecord> {
    validateJourneyAction(input);
    try {
      return await this.database.transaction((tx) => this.startInTransaction(tx, input), {
        userId: input.userId,
        ip: input.auditIp,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const replay = await this.findByOperationId(input.operationId, input.userId);
        if (replay) return reuseStartOrConflict(replay, input);
        throw new JourneyConflictError();
      }
      throw error;
    }
  }

  private async startInTransaction(tx: PgQueryable, input: CreateJourneyInput): Promise<JourneyRecord> {
    const earlyReplay = await this.findByOperationId(input.operationId, input.userId, tx);
    if (earlyReplay) return reuseStartOrConflict(earlyReplay, input);

    const assignment = await tx.query<{ id: string; vehicle_id: string }>(
      `SELECT a.id::text AS id, v.id::text AS vehicle_id
       FROM gacor.asignaciones_vehiculo a
       JOIN gacor.vehiculos v ON v.id = a.vehiculo_id
       WHERE a.piloto_id = $1::bigint
         AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
         AND v.activo = TRUE
         AND v.tipo = 'BRIGADA'::gacor.tipo_vehiculo_enum
       ORDER BY a.fecha_hora_inicio DESC, a.id DESC
       LIMIT 1
       FOR UPDATE OF a, v`, [input.userId],
    );
    const activeAssignment = assignment.rows[0];
    if (!activeAssignment) throw new JourneyNoActiveAssignmentError();

    // Recheck after acquiring the assignment lock so simultaneous retries observe the committed request.
    const lockedReplay = await this.findByOperationId(input.operationId, input.userId, tx);
    if (lockedReplay) return reuseStartOrConflict(lockedReplay, input);

    const openMovement = await tx.query<{ id: string }>(
      `SELECT id::text AS id FROM gacor.movimientos_vehiculo
       WHERE estado = 'ABIERTO'::gacor.estado_movimiento_enum
         AND (usuario_id = $1::bigint OR vehiculo_id = $2::bigint)
       LIMIT 1 FOR UPDATE`, [input.userId, activeAssignment.vehicle_id],
    );
    if (openMovement.rows[0]) throw new JourneyConflictError();

    const reading = await tx.query<{ id: string }>(
      `INSERT INTO gacor.lecturas_odometro
         (vehiculo_id, usuario_id, kilometraje, tipo_lectura, fecha_hora_dispositivo, uuid_operacion)
       VALUES ($1::bigint, $2::bigint, $3::numeric, 'JORNADA_INICIO'::gacor.tipo_lectura_odometro_enum, $4::timestamptz, $5::uuid)
       RETURNING id::text AS id`,
      [activeAssignment.vehicle_id, input.userId, input.kilometers, new Date(input.deviceAt).toISOString(), input.operationId],
    );
    const movement = await tx.query<{ id: string }>(
      `INSERT INTO gacor.movimientos_vehiculo
         (vehiculo_id, usuario_id, tipo, estado, lectura_inicio_id, uuid_operacion)
       VALUES ($1::bigint, $2::bigint, 'JORNADA_BRIGADA'::gacor.tipo_movimiento_enum,
               'ABIERTO'::gacor.estado_movimiento_enum, $3::bigint, $4::uuid)
       RETURNING id::text AS id`,
      [activeAssignment.vehicle_id, input.userId, reading.rows[0]!.id, input.operationId],
    );
    const journey = await tx.query<{ id: string }>(
      `INSERT INTO gacor.jornadas (asignacion_id, movimiento_id, estado, observaciones_inicio, uuid_operacion)
       VALUES ($1::bigint, $2::bigint, 'ABIERTA'::gacor.estado_jornada_enum, $3, $4::uuid)
       RETURNING id::text AS id`,
      [activeAssignment.id, movement.rows[0]!.id, input.observations ?? null, input.operationId],
    );
    return this.findRecordById(journey.rows[0]!.id, input.userId, tx);
  }

  async finish(input: FinishJourneyInput): Promise<JourneyRecord> {
    validateJourneyAction(input);
    assertPositiveBigintIdentifier(input.journeyId, 'journeyId');
    try {
      return await this.database.transaction((tx) => this.finishInTransaction(tx, input), {
        userId: input.userId,
        ip: input.auditIp,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const replay = await this.findFinishByOperationId(input.operationId, input.userId);
        if (replay?.id === input.journeyId) return reuseFinishOrConflict(replay, input);
        throw new JourneyConflictError();
      }
      if (isJourneyOdometerTriggerError(error)) throw new JourneyConflictError();
      throw error;
    }
  }

  private async finishInTransaction(tx: PgQueryable, input: FinishJourneyInput): Promise<JourneyRecord> {
    const journey = await this.findRecordById(input.journeyId, input.userId, tx, true);
    const replay = await this.findFinishByOperationId(input.operationId, input.userId, tx);
    if (replay) {
      if (replay.id !== input.journeyId) throw new JourneyIdempotencyConflictError();
      return reuseFinishOrConflict(replay, input);
    }
    if (journey.state !== 'ABIERTA' || journey.movement.state !== 'ABIERTO' || !journey.initialOdometer) {
      throw new JourneyConflictError();
    }

    const reading = await tx.query<{ id: string }>(
      `INSERT INTO gacor.lecturas_odometro
         (vehiculo_id, usuario_id, kilometraje, tipo_lectura, fecha_hora_dispositivo, uuid_operacion)
       VALUES ($1::bigint, $2::bigint, $3::numeric, 'JORNADA_FIN'::gacor.tipo_lectura_odometro_enum, $4::timestamptz, $5::uuid)
       RETURNING id::text AS id`,
      [journey.vehicle.id, input.userId, input.kilometers, new Date(input.deviceAt).toISOString(), input.operationId],
    );
    await tx.query(
      `UPDATE gacor.movimientos_vehiculo
       SET estado = 'FINALIZADO'::gacor.estado_movimiento_enum, lectura_fin_id = $2::bigint
       WHERE id = $1::bigint AND usuario_id = $3::bigint
         AND estado = 'ABIERTO'::gacor.estado_movimiento_enum`,
      [journey.movement.id, reading.rows[0]!.id, input.userId],
    );
    await tx.query(
      `UPDATE gacor.jornadas
       SET estado = 'FINALIZADA'::gacor.estado_jornada_enum, observaciones_fin = $2
       WHERE id = $1::bigint AND estado = 'ABIERTA'::gacor.estado_jornada_enum`,
      [input.journeyId, input.observations ?? null],
    );
    return this.findRecordById(input.journeyId, input.userId, tx);
  }

  private async findByOperationId(operationId: string, userId: string, queryable: PgQueryable | DatabaseService = this.database): Promise<JourneyRecord | null> {
    const result = await queryable.query<JourneyRow>(
      `${SELECT_JOURNEY_FIELDS}
       WHERE j.uuid_operacion = $1::uuid AND a.piloto_id = $2::bigint AND mv.usuario_id = $2::bigint`,
      [operationId, userId],
    );
    return result.rows[0] ? mapJourney(result.rows[0]) : null;
  }

  private async findFinishByOperationId(operationId: string, userId: string, queryable: PgQueryable | DatabaseService = this.database): Promise<JourneyRecord | null> {
    const result = await queryable.query<JourneyRow>(
      `${SELECT_JOURNEY_FIELDS}
       JOIN gacor.lecturas_odometro operation_reading ON operation_reading.id = mv.lectura_fin_id
       WHERE operation_reading.uuid_operacion = $1::uuid
         AND a.piloto_id = $2::bigint AND mv.usuario_id = $2::bigint`,
      [operationId, userId],
    );
    return result.rows[0] ? mapJourney(result.rows[0]) : null;
  }

  private async findRecordById(id: string, userId: string, queryable: PgQueryable | DatabaseService, forUpdate = false): Promise<JourneyRecord> {
    const result = await queryable.query<JourneyRow>(
      `${SELECT_JOURNEY_FIELDS}
       WHERE j.id = $1::bigint AND a.piloto_id = $2::bigint AND mv.usuario_id = $2::bigint
       ${forUpdate ? 'FOR UPDATE OF j, mv' : ''}`,
      [id, userId],
    );
    if (!result.rows[0]) throw new JourneyNoActiveAssignmentError();
    return mapJourney(result.rows[0]);
  }

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

function validateJourneyAction(input: CreateJourneyInput): void {
  assertPositiveBigintIdentifier(input.userId, 'userId');
  assertUuid(input.operationId, 'operationId');
  if (!/^\d{1,11}(?:\.\d)?$/.test(input.kilometers)) throw new TypeError('Invalid value for kilometers');
  if (!Number.isFinite(new Date(input.deviceAt).getTime())) throw new TypeError('Invalid value for deviceAt');
  if (isIP(input.auditIp) === 0) throw new TypeError('Invalid value for auditIp');
  if (input.observations !== undefined && typeof input.observations !== 'string') throw new TypeError('Invalid value for observations');
}

function reuseStartOrConflict(record: JourneyRecord, input: CreateJourneyInput): JourneyRecord {
  const same = record.assignmentId.length > 0
    && record.initialOdometer !== null
    && sameDecimal(record.initialOdometer.kilometers, input.kilometers)
    && record.initialOdometer.deviceAt === new Date(input.deviceAt).toISOString()
    && record.startObservations === (input.observations ?? null);
  if (!same) throw new JourneyIdempotencyConflictError();
  return record;
}

function reuseFinishOrConflict(record: JourneyRecord, input: FinishJourneyInput): JourneyRecord {
  const same = record.finalOdometer !== null
    && sameDecimal(record.finalOdometer.kilometers, input.kilometers)
    && record.finalOdometer.deviceAt === new Date(input.deviceAt).toISOString()
    && record.endObservations === (input.observations ?? null);
  if (!same) throw new JourneyIdempotencyConflictError();
  return record;
}

function sameDecimal(left: string, right: string): boolean {
  return normalizeDecimal(left) === normalizeDecimal(right);
}

function normalizeDecimal(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === '23505';
}

function isJourneyOdometerTriggerError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
    && (error as { code?: unknown }).code === 'P0001'
    && (error as { message?: unknown }).message === 'Kilometraje final menor al inicial';
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
