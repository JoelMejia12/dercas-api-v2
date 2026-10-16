import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PgQueryable } from '../database/pg-queryable';
import { assertPositiveBigintIdentifier, assertUuid } from '../database/postgres-values';
import { isIP } from 'node:net';

export interface FuelHistoryPagination {
  readonly limit: number;
  readonly offset: number;
}

export interface FuelHistoryItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly gallons: string;
  readonly pricePerGallon: string;
  readonly totalPaid: string;
  readonly observations: string | null;
  readonly location: {
    readonly gasStationId: string | null;
    readonly gasStationName: string | null;
    readonly manualName: string | null;
    readonly latitude: string | null;
    readonly longitude: string | null;
  };
  readonly vehicle: { readonly id: string; readonly plate: string };
  readonly movement: {
    readonly id: string;
    readonly type: string;
    readonly state: string;
    readonly loanId: string | null;
    readonly journeyId: string | null;
  };
  readonly odometer: {
    readonly id: string;
    readonly kilometers: string;
    readonly recordedAt: string;
    readonly photoUrl: string | null;
  };
}

export interface CreateFuelInput {
  readonly userId: string;
  readonly movementId: string;
  readonly operationId: string;
  readonly kilometers: string;
  readonly deviceAt: string;
  readonly gallons: string;
  readonly pricePerGallon: string;
  readonly totalPaid: string;
  readonly gasStationId?: string | null;
  readonly latitude?: string | null;
  readonly longitude?: string | null;
  readonly manualPlaceName?: string | null;
  readonly observations?: string | null;
  readonly auditIp: string;
}

export interface FuelChargeRecord { readonly id: string; readonly movementId: string; readonly odometerId: string; readonly occurredAt: string }

interface FuelHistoryRow {
  id: string;
  occurred_at: Date | string;
  gallons: string;
  price_per_gallon: string;
  total_paid: string;
  observations: string | null;
  gas_station_id: string | null;
  gas_station_name: string | null;
  manual_name: string | null;
  latitude: string | null;
  longitude: string | null;
  vehicle_id: string;
  vehicle_plate: string;
  movement_id: string;
  movement_type: string;
  movement_state: string;
  loan_id: string | null;
  journey_id: string | null;
  odometer_id: string;
  odometer_kilometers: string;
  odometer_recorded_at: Date | string;
  odometer_photo_url: string | null;
}

interface FuelIdempotencyRow {
  id: string; movement_id: string; user_id: string; odometer_kilometers: string; device_at: Date | string;
  gallons: string; price_per_gallon: string; total_paid: string; gas_station_id: string | null;
  latitude: string | null; longitude: string | null; manual_name: string | null; observations: string | null;
  odometer_id: string; occurred_at: Date | string;
}

export class FuelMovementNotFoundError extends Error {}
export class FuelIdempotencyConflictError extends Error {}

@Injectable()
export class FuelRepository {
  constructor(private readonly database: DatabaseService) {}

  async findHistoryForUser(
    userId: string,
    pagination: FuelHistoryPagination,
  ): Promise<readonly FuelHistoryItem[]> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<FuelHistoryRow>(
      `SELECT cc.id::text AS id, cc.fecha_hora AS occurred_at,
              cc.galones::text AS gallons, cc.precio_galon::text AS price_per_gallon,
              cc.total_pagado::text AS total_paid, cc.observaciones AS observations,
              gs.id::text AS gas_station_id, gs.nombre AS gas_station_name,
              cc.nombre_lugar_manual AS manual_name, cc.latitud::text AS latitude,
              cc.longitud::text AS longitude,
              v.id::text AS vehicle_id, v.placa AS vehicle_plate,
              mv.id::text AS movement_id, mv.tipo::text AS movement_type, mv.estado::text AS movement_state,
              p.id::text AS loan_id, j.id::text AS journey_id,
              lo.id::text AS odometer_id, lo.kilometraje::text AS odometer_kilometers,
              lo.fecha_hora_servidor AS odometer_recorded_at, lo.foto_url AS odometer_photo_url
       FROM gacor.cargas_combustible cc
       JOIN gacor.movimientos_vehiculo mv ON mv.id = cc.movimiento_id
       JOIN gacor.vehiculos v ON v.id = mv.vehiculo_id
       JOIN gacor.lecturas_odometro lo ON lo.id = cc.lectura_odometro_id
       LEFT JOIN gacor.gasolineras gs ON gs.id = cc.gasolinera_id
       LEFT JOIN gacor.prestamos_administrativos p ON p.movimiento_id = mv.id
       LEFT JOIN gacor.jornadas j ON j.movimiento_id = mv.id
       WHERE mv.usuario_id = $1::bigint
       ORDER BY cc.fecha_hora DESC, cc.id DESC
       LIMIT $2::integer OFFSET $3::integer`,
      [userId, pagination.limit + 1, pagination.offset],
    );
    return result.rows.map(mapFuelHistoryRow);
  }

  async findByIdForUser(id: string, userId: string): Promise<FuelHistoryItem | null> {
    assertPositiveBigintIdentifier(id, 'fuelId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<FuelHistoryRow>(
      `${FUEL_HISTORY_SELECT}\n       WHERE cc.id = $1::bigint AND mv.usuario_id = $2::bigint`, [id, userId],
    );
    return result.rows[0] ? mapFuelHistoryRow(result.rows[0]) : null;
  }

  async create(input: CreateFuelInput): Promise<FuelChargeRecord> {
    assertPositiveBigintIdentifier(input.userId, 'userId');
    assertPositiveBigintIdentifier(input.movementId, 'movementId');
    if (input.gasStationId) assertPositiveBigintIdentifier(input.gasStationId, 'gasStationId');
    assertUuid(input.operationId, 'operationId');
    if (isIP(input.auditIp) === 0) throw new TypeError('Invalid value for auditIp');
    const deviceAt = new Date(input.deviceAt);
    if (!Number.isFinite(deviceAt.getTime())) throw new TypeError('Invalid value for deviceAt');
    assertSqlDecimal(input.gallons, 10, 3, true, 'gallons');
    assertSqlDecimal(input.pricePerGallon, 12, 2, false, 'pricePerGallon');
    assertSqlDecimal(input.totalPaid, 12, 2, false, 'totalPaid');
    assertSqlDecimal(input.kilometers, 12, 1, false, 'kilometers');
    assertCoordinate(input.latitude, -90, 90, 'latitude');
    assertCoordinate(input.longitude, -180, 180, 'longitude');
    try {
      return await this.database.transaction(async (tx) => this.createInTransaction(tx, input, deviceAt), {
        userId: input.userId, ip: input.auditIp,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.findChargeByOperationId(this.database, input.operationId);
        if (existing) return this.reuseOrConflict(existing, input, deviceAt);
      }
      throw error;
    }
  }

  private async createInTransaction(tx: PgQueryable, input: CreateFuelInput, deviceAt: Date): Promise<FuelChargeRecord> {
    const existing = await this.findChargeByOperationId(tx, input.operationId);
    if (existing) return this.reuseOrConflict(existing, input, deviceAt);

    const movement = await tx.query<{ id: string }>(
      `SELECT id::text AS id FROM gacor.movimientos_vehiculo
       WHERE id=$1::bigint AND usuario_id=$2::bigint FOR SHARE`, [input.movementId, input.userId],
    );
    if (!movement.rows[0]) throw new FuelMovementNotFoundError();

    const reading = await tx.query<{ id: string }>(
      `INSERT INTO gacor.lecturas_odometro (vehiculo_id, usuario_id, kilometraje, tipo_lectura, fecha_hora_dispositivo, uuid_operacion)
       SELECT mv.vehiculo_id, mv.usuario_id, $3::numeric, 'COMBUSTIBLE'::gacor.tipo_lectura_odometro_enum, $4::timestamptz, $5::uuid
       FROM gacor.movimientos_vehiculo mv
       WHERE mv.id = $1::bigint AND mv.usuario_id = $2::bigint
       ON CONFLICT (uuid_operacion) DO NOTHING
       RETURNING id::text AS id`,
      [input.movementId, input.userId, input.kilometers, deviceAt.toISOString(), input.operationId],
    );
    if (!reading.rows[0]) {
      const replay = await this.findChargeByOperationId(tx, input.operationId);
      if (replay) return this.reuseOrConflict(replay, input, deviceAt);
      throw new FuelIdempotencyConflictError();
    }
    const inserted = await tx.query<{ id: string; movement_id: string; occurred_at: Date | string }>(
      `INSERT INTO gacor.cargas_combustible
         (movimiento_id, lectura_odometro_id, gasolinera_id, galones, precio_galon, total_pagado, latitud, longitud, nombre_lugar_manual, observaciones, uuid_operacion)
       SELECT mv.id, $3::bigint, $4::bigint, $5::numeric, $6::numeric, $7::numeric, $8::numeric, $9::numeric, $10, $11, $12::uuid
       FROM gacor.movimientos_vehiculo mv
       WHERE mv.id = $1::bigint AND mv.usuario_id = $2::bigint
       RETURNING id::text AS id, movimiento_id::text AS movement_id, fecha_hora AS occurred_at`,
      [input.movementId, input.userId, reading.rows[0].id, input.gasStationId ?? null, input.gallons,
        input.pricePerGallon, input.totalPaid, input.latitude ?? null, input.longitude ?? null,
        input.manualPlaceName ?? null, input.observations ?? null, input.operationId],
    );
    const row = inserted.rows[0];
    if (!row) throw new FuelMovementNotFoundError();
    return { id: row.id, movementId: row.movement_id, odometerId: reading.rows[0].id, occurredAt: toIso(row.occurred_at) };
  }

  private async findChargeByOperationId(queryable: Pick<PgQueryable, 'query'>, operationId: string): Promise<FuelIdempotencyRow | null> {
    const result = await queryable.query<FuelIdempotencyRow>(
      `SELECT cc.id::text AS id, cc.movimiento_id::text AS movement_id, mv.usuario_id::text AS user_id,
              lo.kilometraje::text AS odometer_kilometers, lo.fecha_hora_dispositivo AS device_at,
              cc.galones::text AS gallons, cc.precio_galon::text AS price_per_gallon, cc.total_pagado::text AS total_paid,
              cc.gasolinera_id::text AS gas_station_id, cc.latitud::text AS latitude, cc.longitud::text AS longitude,
              cc.nombre_lugar_manual AS manual_name, cc.observaciones AS observations,
              lo.id::text AS odometer_id, cc.fecha_hora AS occurred_at
       FROM gacor.cargas_combustible cc JOIN gacor.movimientos_vehiculo mv ON mv.id=cc.movimiento_id
       JOIN gacor.lecturas_odometro lo ON lo.id=cc.lectura_odometro_id WHERE cc.uuid_operacion=$1::uuid`, [operationId],
    );
    return result.rows[0] ?? null;
  }

  private reuseOrConflict(row: FuelIdempotencyRow, input: CreateFuelInput, deviceAt: Date): FuelChargeRecord {
    const matches = {
      user: row.user_id === input.userId,
      movement: row.movement_id === input.movementId,
      odometer: sameDecimal(row.odometer_kilometers, input.kilometers),
      deviceAt: toIso(row.device_at) === deviceAt.toISOString(),
      gallons: sameDecimal(row.gallons, input.gallons),
      price: sameDecimal(row.price_per_gallon, input.pricePerGallon),
      total: sameDecimal(row.total_paid, input.totalPaid),
      gasStation: row.gas_station_id === (input.gasStationId ?? null),
      latitude: sameNullableDecimal(row.latitude, input.latitude),
      longitude: sameNullableDecimal(row.longitude, input.longitude),
      placeName: row.manual_name === (input.manualPlaceName ?? null),
      observations: row.observations === (input.observations ?? null),
    };
    const mismatches = Object.entries(matches).filter(([, matchesInput]) => !matchesInput).map(([field]) => field);
    if (mismatches.length) throw new FuelIdempotencyConflictError(`Fuel operation replay mismatch: ${mismatches.join(', ')}`);
    return { id: row.id, movementId: row.movement_id, odometerId: row.odometer_id, occurredAt: toIso(row.occurred_at) };
  }
}

const FUEL_HISTORY_SELECT = `SELECT cc.id::text AS id, cc.fecha_hora AS occurred_at,
              cc.galones::text AS gallons, cc.precio_galon::text AS price_per_gallon,
              cc.total_pagado::text AS total_paid, cc.observaciones AS observations,
              gs.id::text AS gas_station_id, gs.nombre AS gas_station_name,
              cc.nombre_lugar_manual AS manual_name, cc.latitud::text AS latitude,
              cc.longitud::text AS longitude,
              v.id::text AS vehicle_id, v.placa AS vehicle_plate,
              mv.id::text AS movement_id, mv.tipo::text AS movement_type, mv.estado::text AS movement_state,
              p.id::text AS loan_id, j.id::text AS journey_id,
              lo.id::text AS odometer_id, lo.kilometraje::text AS odometer_kilometers,
              lo.fecha_hora_servidor AS odometer_recorded_at, lo.foto_url AS odometer_photo_url
       FROM gacor.cargas_combustible cc
       JOIN gacor.movimientos_vehiculo mv ON mv.id = cc.movimiento_id
       JOIN gacor.vehiculos v ON v.id = mv.vehiculo_id
       JOIN gacor.lecturas_odometro lo ON lo.id = cc.lectura_odometro_id
       LEFT JOIN gacor.gasolineras gs ON gs.id = cc.gasolinera_id
       LEFT JOIN gacor.prestamos_administrativos p ON p.movimiento_id = mv.id
       LEFT JOIN gacor.jornadas j ON j.movimiento_id = mv.id`;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}
function sameNullableDecimal(actual: string | null, expected: string | null | undefined): boolean {
  return actual === (expected ?? null) || (actual !== null && expected != null && sameDecimal(actual, expected));
}
function sameDecimal(a: string, b: string): boolean { return canonicalDecimal(a) === canonicalDecimal(b); }
function canonicalDecimal(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return `${whole}.${trimmed}`;
}
function assertSqlDecimal(value: string, precision: number, scale: number, positive: boolean, field: string): void {
  const expression = new RegExp(`^(?:0|[1-9]\\d{0,${precision - scale - 1}})(?:\\.\\d{1,${scale}})?$`);
  if (!expression.test(value)) throw new TypeError(`Invalid value for ${field}`);
  if (positive && Number(value) <= 0) throw new TypeError(`Invalid value for ${field}`);
}
function assertCoordinate(value: string | null | undefined, min: number, max: number, field: string): void {
  if (value === undefined || value === null) return;
  if (!/^-?(?:0|[1-9]\d{0,2})(?:\.\d{1,6})?$/.test(value) || Number(value) < min || Number(value) > max) {
    throw new TypeError(`Invalid value for ${field}`);
  }
}

function mapFuelHistoryRow(row: FuelHistoryRow): FuelHistoryItem {
  return {
    id: row.id,
    occurredAt: toIso(row.occurred_at),
    gallons: row.gallons,
    pricePerGallon: row.price_per_gallon,
    totalPaid: row.total_paid,
    observations: row.observations,
    location: {
      gasStationId: row.gas_station_id,
      gasStationName: row.gas_station_name,
      manualName: row.manual_name,
      latitude: row.latitude,
      longitude: row.longitude,
    },
    vehicle: { id: row.vehicle_id, plate: row.vehicle_plate },
    movement: {
      id: row.movement_id,
      type: row.movement_type,
      state: row.movement_state,
      loanId: row.loan_id,
      journeyId: row.journey_id,
    },
    odometer: {
      id: row.odometer_id,
      kilometers: row.odometer_kilometers,
      recordedAt: toIso(row.odometer_recorded_at),
      photoUrl: row.odometer_photo_url,
    },
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
