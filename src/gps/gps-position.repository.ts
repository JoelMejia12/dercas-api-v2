import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PgQueryable } from '../database/pg-queryable';
import {
  assertFiniteRange,
  assertNumericPrecision,
  assertPositiveBigintIdentifier,
  assertRequiredFiniteRange,
  assertUuid,
} from '../database/postgres-values';

export interface GpsPositionInput {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly capturedAt: Date;
  readonly accuracyMeters?: number;
  readonly speedKmh?: number;
  readonly headingDegrees?: number;
  readonly altitudeMeters?: number;
  readonly batteryPercentage?: number;
  readonly operationId: string;
}

export interface StoredGpsPosition {
  readonly id: string;
  readonly serverReceivedAt: Date;
}

interface StoredGpsPositionRow {
  id: string;
  fecha_hora_servidor: Date;
}

interface GpsPositionReplayRow {
  id: string;
  fecha_hora_servidor: Date;
  sesion_seguimiento_id: string;
  dispositivo_id: string;
  longitude: number;
  latitude: number;
  precision_metros: string | null;
  velocidad_kmh: string | null;
  rumbo_grados: string | null;
  altitud_metros: string | null;
  bateria_porcentaje: number | null;
  fecha_hora_dispositivo: Date;
}

export class GpsPositionIdempotencyConflictError extends Error {
  constructor() {
    super('GPS operation identifier was already used for a different payload');
    this.name = 'GpsPositionIdempotencyConflictError';
  }
}

@Injectable()
export class GpsPositionRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(input: GpsPositionInput): Promise<StoredGpsPosition> {
    assertPositiveBigintIdentifier(input.sessionId, 'sessionId');
    assertPositiveBigintIdentifier(input.deviceId, 'deviceId');
    assertRequiredFiniteRange(input.longitude, 'longitude', -180, 180);
    assertRequiredFiniteRange(input.latitude, 'latitude', -90, 90);
    assertFiniteRange(input.accuracyMeters, 'accuracyMeters', 0, 1_000_000, true);
    assertFiniteRange(input.speedKmh, 'speedKmh', 0, 1_000_000, true);
    assertFiniteRange(input.headingDegrees, 'headingDegrees', 0, 360, true);
    assertNumericPrecision(input.accuracyMeters, 'accuracyMeters', 8, 2);
    assertNumericPrecision(input.speedKmh, 'speedKmh', 8, 2);
    assertNumericPrecision(input.headingDegrees, 'headingDegrees', 6, 2);
    assertNumericPrecision(input.altitudeMeters, 'altitudeMeters', 9, 2);
    if (input.headingDegrees !== undefined && input.headingDegrees >= 359.995) {
      throw new TypeError('Invalid value for headingDegrees');
    }
    if (input.batteryPercentage !== undefined
      && (!Number.isInteger(input.batteryPercentage) || input.batteryPercentage < 0 || input.batteryPercentage > 100)) {
      throw new TypeError('Invalid value for batteryPercentage');
    }
    if (!(input.capturedAt instanceof Date) || !Number.isFinite(input.capturedAt.getTime())) {
      throw new TypeError('Invalid value for capturedAt');
    }
    assertUuid(input.operationId, 'operationId');

    return this.database.transaction(async (tx) => {
      // The DDL cannot create a global UUID index on a range-partitioned table.
      // Serialize a key in the application and use its partition-local unique index
      // for replay lookup before inserting another point.
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [input.operationId]);
      const previous = await findByOperationId(tx, input.operationId);
      if (previous) return reuseOrConflict(previous, input);

      const result = await tx.query<StoredGpsPositionRow>(
        `INSERT INTO gacor.posiciones_gps (
         sesion_seguimiento_id, dispositivo_id, ubicacion, precision_metros,
         velocidad_kmh, rumbo_grados, altitud_metros, bateria_porcentaje,
         fecha_hora_dispositivo, uuid_operacion
       ) VALUES (
         $1, $2,
         ST_SetSRID(ST_MakePoint($3::double precision, $4::double precision), 4326)::geography,
         $5, $6, $7, $8, $9, $10, $11
       )
         RETURNING id, fecha_hora_servidor`,
        [
          input.sessionId,
          input.deviceId,
          input.longitude,
          input.latitude,
          input.accuracyMeters ?? null,
          input.speedKmh ?? null,
          input.headingDegrees ?? null,
          input.altitudeMeters ?? null,
          input.batteryPercentage ?? null,
          input.capturedAt,
          input.operationId,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('GPS insert returned no row');
      return { id: row.id, serverReceivedAt: row.fecha_hora_servidor };
    });
  }
}

async function findByOperationId(tx: PgQueryable, operationId: string): Promise<GpsPositionReplayRow | null> {
  const result = await tx.query<GpsPositionReplayRow>(
    `SELECT id::text AS id, fecha_hora_servidor, sesion_seguimiento_id::text AS sesion_seguimiento_id,
            dispositivo_id::text AS dispositivo_id,
            ST_X(ubicacion::geometry) AS longitude, ST_Y(ubicacion::geometry) AS latitude,
            precision_metros::text AS precision_metros, velocidad_kmh::text AS velocidad_kmh,
            rumbo_grados::text AS rumbo_grados, altitud_metros::text AS altitud_metros,
            bateria_porcentaje, fecha_hora_dispositivo
     FROM gacor.posiciones_gps WHERE uuid_operacion = $1::uuid
     ORDER BY fecha_hora_servidor DESC LIMIT 1`,
    [operationId],
  );
  return result.rows[0] ?? null;
}

function reuseOrConflict(row: GpsPositionReplayRow, input: GpsPositionInput): StoredGpsPosition {
  const same = row.sesion_seguimiento_id === input.sessionId && row.dispositivo_id === input.deviceId
    && row.longitude === input.longitude && row.latitude === input.latitude
    && sameNullableNumber(row.precision_metros, input.accuracyMeters)
    && sameNullableNumber(row.velocidad_kmh, input.speedKmh)
    && sameNullableNumber(row.rumbo_grados, input.headingDegrees)
    && sameNullableNumber(row.altitud_metros, input.altitudeMeters)
    && row.bateria_porcentaje === (input.batteryPercentage ?? null)
    && row.fecha_hora_dispositivo.getTime() === input.capturedAt.getTime();
  if (!same) throw new GpsPositionIdempotencyConflictError();
  return { id: row.id, serverReceivedAt: row.fecha_hora_servidor };
}

function sameNullableNumber(actual: string | null, expected: number | undefined): boolean {
  return actual === null ? expected === undefined : expected !== undefined && Number(actual) === expected;
}
