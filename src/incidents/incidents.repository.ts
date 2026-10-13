import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { DatabaseService } from '../database/database.service';
import { PgQueryable } from '../database/pg-queryable';
import { assertPositiveBigintIdentifier, assertUuid } from '../database/postgres-values';
import { IncidentHistoryQueryDto } from './incident-history-query.dto';
import { IncidentType } from './incident.dto';

export interface IncidentRecord {
  readonly id: string;
  readonly vehicleId: string | null;
  readonly movementId: string | null;
  readonly type: string;
  readonly priority: string;
  readonly description: string;
  readonly status: string;
  readonly reportedAt: string;
  readonly closedAt: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
}

export interface CreateIncidentInput {
  readonly userId: string;
  readonly type: IncidentType;
  readonly description: string;
  readonly operationId: string;
  readonly auditIp: string;
  readonly latitude?: string;
  readonly longitude?: string;
}

export interface IncidentHistoryPageData {
  readonly rows: readonly IncidentRecord[];
  readonly hasMore: boolean;
}

interface IncidentRow {
  id: string;
  vehicle_id: string | null;
  movement_id: string | null;
  type: string;
  priority: string;
  description: string;
  status: string;
  reported_at: Date | string;
  closed_at: Date | string | null;
  user_id?: string;
  operation_id?: string;
  latitude?: string | null;
  longitude?: string | null;
}

export class NoActiveAssignedVehicleError extends Error {
  constructor() {
    super();
    this.name = 'NoActiveAssignedVehicleError';
  }
}

export class IncidentIdempotencyConflictError extends Error {
  constructor() {
    super();
    this.name = 'IncidentIdempotencyConflictError';
  }
}

@Injectable()
export class IncidentsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateIncidentInput): Promise<IncidentRecord> {
    assertPositiveBigintIdentifier(input.userId, 'userId');
    assertUuid(input.operationId, 'operationId');
    if (isIP(input.auditIp) === 0) throw new TypeError('Invalid value for auditIp');

    return this.database.transaction(
      async (tx) => this.createInTransaction(tx, input),
      { userId: input.userId, ip: input.auditIp },
    );
  }

  async findByIdForUser(id: string, userId: string): Promise<IncidentRecord | null> {
    assertPositiveBigintIdentifier(id, 'incidentId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<IncidentRow>(
      `${SELECT_INCIDENT_FIELDS}
       FROM gacor.incidencias i
       WHERE i.id = $1::bigint AND i.usuario_id = $2::bigint`,
      [id, userId],
    );
    return result.rows[0] ? mapIncident(result.rows[0]) : null;
  }

  async findHistoryForUser(userId: string, query: IncidentHistoryQueryDto): Promise<IncidentHistoryPageData> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<IncidentRow>(
      `${SELECT_INCIDENT_FIELDS}
       FROM gacor.incidencias i
       WHERE i.usuario_id = $1::bigint AND ($4::text IS NULL OR i.tipo::text = $4::text)
       ORDER BY i.fecha_hora DESC, i.id DESC
       LIMIT $2::integer OFFSET $3::integer`,
      [userId, query.limit + 1, query.offset, query.type ?? null],
    );
    const hasMore = result.rows.length > query.limit;
    const page = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    return { rows: page.map(mapIncident), hasMore };
  }

  private async createInTransaction(tx: PgQueryable, input: CreateIncidentInput): Promise<IncidentRecord> {
    const existing = await this.findByOperationId(tx, input.operationId, input.userId);
    if (existing) return reuseOrConflict(existing, input);

    const inserted = await tx.query<IncidentRow>(
      `WITH active_vehicle AS (
         SELECT v.id AS vehicle_id,
                (SELECT mv.id FROM gacor.movimientos_vehiculo mv
                 WHERE mv.vehiculo_id = v.id AND mv.usuario_id = $1::bigint
                   AND mv.estado = 'ABIERTO'::gacor.estado_movimiento_enum
                 ORDER BY mv.fecha_hora_inicio DESC, mv.id DESC
                 LIMIT 1) AS movement_id
         FROM gacor.asignaciones_vehiculo a
         JOIN gacor.vehiculos v ON v.id = a.vehiculo_id AND v.activo = TRUE
         WHERE a.piloto_id = $1::bigint
           AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
         FOR SHARE OF a, v
       )
       INSERT INTO gacor.incidencias
         (vehiculo_id, usuario_id, movimiento_id, tipo, descripcion, latitud, longitud, uuid_operacion)
       SELECT active_vehicle.vehicle_id, $1::bigint, active_vehicle.movement_id,
              $2::gacor.tipo_incidencia_enum, $3, $4::numeric, $5::numeric, $6::uuid
       FROM active_vehicle
       ON CONFLICT (uuid_operacion) DO NOTHING
       RETURNING id::text AS id, vehiculo_id::text AS vehicle_id,
                 movimiento_id::text AS movement_id, tipo::text AS type,
                 prioridad::text AS priority, descripcion AS description,
                 estado::text AS status, fecha_hora AS reported_at, fecha_cierre AS closed_at,
                 usuario_id::text AS user_id, uuid_operacion::text AS operation_id,
                 latitud::text AS latitude, longitud::text AS longitude`,
      [input.userId, input.type, input.description, input.latitude ?? null, input.longitude ?? null, input.operationId],
    );
    if (inserted.rows[0]) return mapIncident(inserted.rows[0]);

    const replay = await this.findByOperationId(tx, input.operationId, input.userId);
    if (replay) return reuseOrConflict(replay, input);
    const keyUsed = await tx.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM gacor.incidencias WHERE uuid_operacion = $1::uuid) AS exists',
      [input.operationId],
    );
    if (keyUsed.rows[0]?.exists) throw new IncidentIdempotencyConflictError();
    throw new NoActiveAssignedVehicleError();
  }

  private async findByOperationId(tx: PgQueryable, operationId: string, userId: string): Promise<IncidentRow | null> {
    const result = await tx.query<IncidentRow>(
      `SELECT id::text AS id, vehiculo_id::text AS vehicle_id, movimiento_id::text AS movement_id,
              tipo::text AS type, prioridad::text AS priority, descripcion AS description,
              estado::text AS status, fecha_hora AS reported_at, fecha_cierre AS closed_at,
              usuario_id::text AS user_id, uuid_operacion::text AS operation_id,
              latitud::text AS latitude, longitud::text AS longitude
       FROM gacor.incidencias
       WHERE uuid_operacion = $1::uuid AND usuario_id = $2::bigint`,
      [operationId, userId],
    );
    return result.rows[0] ?? null;
  }
}

const SELECT_INCIDENT_FIELDS = `SELECT i.id::text AS id, i.vehiculo_id::text AS vehicle_id,
  i.movimiento_id::text AS movement_id, i.tipo::text AS type,
  i.prioridad::text AS priority, i.descripcion AS description,
  i.estado::text AS status, i.fecha_hora AS reported_at, i.fecha_cierre AS closed_at,
  i.latitud::text AS latitude, i.longitud::text AS longitude`;

function reuseOrConflict(row: IncidentRow, input: CreateIncidentInput): IncidentRecord {
  if (row.user_id !== input.userId || row.type !== input.type || row.description !== input.description ||
      normalizeCoordinate(row.latitude ?? null) !== normalizeCoordinate(input.latitude ?? null) ||
      normalizeCoordinate(row.longitude ?? null) !== normalizeCoordinate(input.longitude ?? null)) {
    throw new IncidentIdempotencyConflictError();
  }
  return mapIncident(row);
}

function mapIncident(row: IncidentRow): IncidentRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    movementId: row.movement_id,
    type: row.type,
    priority: row.priority,
    description: row.description,
    status: row.status,
    reportedAt: toIso(row.reported_at),
    closedAt: row.closed_at === null ? null : toIso(row.closed_at),
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

function normalizeCoordinate(value: string | null): string | null {
  return value === null ? null : Number(value).toFixed(6);
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
