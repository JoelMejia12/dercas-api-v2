import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
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

    const result = await this.database.query<StoredGpsPositionRow>(
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
  }
}
