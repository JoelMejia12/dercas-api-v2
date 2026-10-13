import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { DatabaseService } from '../database/database.service';
import { PgQueryable } from '../database/pg-queryable';
import { assertPositiveBigintIdentifier, assertUuid } from '../database/postgres-values';

export interface CreateLoanRequestInput {
  readonly vehicleId: string;
  readonly userId: string;
  readonly operationId: string;
  readonly destination?: string | null;
  readonly reason?: string | null;
  readonly auditIp: string;
}

export interface LoanRequestRecord {
  readonly id: string;
  readonly vehicleId: string;
  readonly status: string;
  readonly requestedAt: string;
  readonly destination: string | null;
  readonly reason: string | null;
}

interface LoanRequestSummaryRow {
  id: string;
  vehicle_id: string;
  status: string;
  requested_at: Date | string;
  destination: string | null;
  reason: string | null;
}

interface LoanRequestRow {
  id: string;
  vehicle_id: string;
  status: string;
  requested_at: Date | string;
  destination: string | null;
  reason: string | null;
  user_id: string;
  operation_id: string;
}

export class LoanRequestVehicleNotFoundError extends Error {}
export class LoanRequestUnavailableError extends Error {}
export class LoanRequestIdempotencyConflictError extends Error {}

@Injectable()
export class LoanRequestRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateLoanRequestInput): Promise<LoanRequestRecord> {
    assertPositiveBigintIdentifier(input.vehicleId, 'vehicleId');
    assertPositiveBigintIdentifier(input.userId, 'userId');
    assertUuid(input.operationId, 'operationId');
    if (typeof input.auditIp !== 'string' || isIP(input.auditIp) === 0) {
      throw new TypeError('Invalid value for auditIp');
    }

    try {
      return await this.database.transaction(
        async (tx) => this.createInTransaction(tx, input),
        { userId: input.userId, ip: input.auditIp },
      );
    } catch (error) {
      if (isActiveLoanUniqueConflict(error)) throw new LoanRequestUnavailableError();
      throw error;
    }
  }

  async findByIdForUser(id: string, userId: string): Promise<LoanRequestRecord | null> {
    assertPositiveBigintIdentifier(id, 'loanId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<LoanRequestSummaryRow>(
      `SELECT id::text AS id, vehiculo_id::text AS vehicle_id, estado::text AS status,
              fecha_hora_solicitud AS requested_at, destino AS destination, motivo AS reason
       FROM gacor.prestamos_administrativos
       WHERE id = $1::bigint AND usuario_id = $2::bigint`,
      [id, userId],
    );
    const row = result.rows[0];
    return row ? mapSummary(row) : null;
  }

  private async createInTransaction(tx: PgQueryable, input: CreateLoanRequestInput): Promise<LoanRequestRecord> {
    const existing = await this.findByOperationId(tx, input.operationId);
    if (existing) return reuseOrConflict(existing, input);

    const vehicle = await tx.query<{ id: string }>(
      'SELECT id::text AS id FROM gacor.vehiculos WHERE id = $1::bigint FOR UPDATE',
      [input.vehicleId],
    );
    if (!vehicle.rows[0]) throw new LoanRequestVehicleNotFoundError();

    // Serialize requests for this vehicle, then recheck idempotency after a possible lock wait.
    const afterLock = await this.findByOperationId(tx, input.operationId);
    if (afterLock) return reuseOrConflict(afterLock, input);

    const availability = await tx.query<{ vehicle_id: string }>(
      `SELECT available.vehiculo_id::text AS vehicle_id
       FROM gacor.vw_vehiculos_administrativos_disponibles available
       JOIN gacor.gabinetes cabinet ON cabinet.id = available.gabinete_id
       WHERE available.vehiculo_id = $1::bigint
         AND cabinet.estado = 'ONLINE'::gacor.estado_gabinete_enum`,
      [input.vehicleId],
    );
    if (!availability.rows[0]) throw new LoanRequestUnavailableError();

    const inserted = await tx.query<LoanRequestRow>(
      `INSERT INTO gacor.prestamos_administrativos
         (vehiculo_id, usuario_id, destino, motivo, estado, uuid_operacion)
       VALUES ($1::bigint, $2::bigint, $3, $4, 'SOLICITADO'::gacor.estado_prestamo_enum, $5::uuid)
       ON CONFLICT (uuid_operacion) DO NOTHING
       RETURNING id::text AS id, vehiculo_id::text AS vehicle_id, estado::text AS status,
                 fecha_hora_solicitud AS requested_at, destino AS destination, motivo AS reason,
                 usuario_id::text AS user_id, uuid_operacion::text AS operation_id`,
      [input.vehicleId, input.userId, input.destination ?? null, input.reason ?? null, input.operationId],
    );
    if (inserted.rows[0]) return mapRequest(inserted.rows[0]);

    const replay = await this.findByOperationId(tx, input.operationId);
    if (replay) return reuseOrConflict(replay, input);
    throw new LoanRequestUnavailableError();
  }

  private async findByOperationId(tx: PgQueryable, operationId: string): Promise<LoanRequestRow | null> {
    const result = await tx.query<LoanRequestRow>(
      `SELECT id::text AS id, vehiculo_id::text AS vehicle_id, estado::text AS status,
              fecha_hora_solicitud AS requested_at, destino AS destination, motivo AS reason,
              usuario_id::text AS user_id, uuid_operacion::text AS operation_id
       FROM gacor.prestamos_administrativos WHERE uuid_operacion = $1::uuid`,
      [operationId],
    );
    return result.rows[0] ?? null;
  }
}

function reuseOrConflict(row: LoanRequestRow, input: CreateLoanRequestInput): LoanRequestRecord {
  const sameRequest = row.user_id === input.userId
    && row.vehicle_id === input.vehicleId
    && row.destination === (input.destination ?? null)
    && row.reason === (input.reason ?? null);
  if (!sameRequest) throw new LoanRequestIdempotencyConflictError();
  return mapRequest(row);
}

function mapRequest(row: LoanRequestRow): LoanRequestRecord {
  return mapSummary(row);
}

function mapSummary(row: LoanRequestSummaryRow): LoanRequestRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    status: row.status,
    requestedAt: new Date(row.requested_at).toISOString(),
    destination: row.destination,
    reason: row.reason,
  };
}

function isActiveLoanUniqueConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const postgresError = error as { code?: unknown; constraint?: unknown };
  return postgresError.code === '23505' && postgresError.constraint === 'uq_prestamo_activo_vehiculo';
}
