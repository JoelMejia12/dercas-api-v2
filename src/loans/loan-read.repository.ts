import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';

export interface LoanReadItem {
  readonly id: string;
  readonly status: string;
  readonly requestedAt: string;
  readonly keyWithdrawnAt: string | null;
  readonly useStartedAt: string | null;
  readonly useEndedAt: string | null;
  readonly keyReturnedAt: string | null;
  readonly destination: string | null;
  readonly reason: string | null;
  readonly returnObservations: string | null;
  readonly vehicle: {
    readonly id: string;
    readonly plate: string;
    readonly make: string;
    readonly model: string | null;
    readonly kind: string;
    readonly operationalState: string;
  };
  readonly movement: {
    readonly id: string;
    readonly state: string;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly initialOdometer: { readonly id: string; readonly value: string; readonly type: string; readonly recordedAt: string } | null;
    readonly finalOdometer: { readonly id: string; readonly value: string; readonly type: string; readonly recordedAt: string } | null;
  } | null;
}

export interface LoanReadPagination {
  readonly limit: number;
  readonly offset: number;
}
export interface AvailableAdministrativeVehicle {
  readonly vehicle: { readonly id: string; readonly plate: string; readonly make: string; readonly model: string | null };
  readonly latestKilometers: string | null;
}
export interface AvailableVehiclePage { readonly items: readonly AvailableAdministrativeVehicle[]; readonly hasMore: boolean }

interface LoanReadRow {
  id: string;
  status: string;
  requested_at: Date | string;
  key_withdrawn_at: Date | string | null;
  use_started_at: Date | string | null;
  use_ended_at: Date | string | null;
  key_returned_at: Date | string | null;
  destination: string | null;
  reason: string | null;
  return_observations: string | null;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string | null;
  vehicle_kind: string;
  vehicle_operational_state: string;
  movement_id: string | null;
  movement_state: string | null;
  movement_started_at: Date | string | null;
  movement_ended_at: Date | string | null;
  initial_odometer_id: string | null;
  initial_odometer_value: string | null;
  initial_odometer_type: string | null;
  initial_odometer_at: Date | string | null;
  final_odometer_id: string | null;
  final_odometer_value: string | null;
  final_odometer_type: string | null;
  final_odometer_at: Date | string | null;
}

@Injectable()
export class LoanReadRepository {
  constructor(private readonly database: DatabaseService) {}

  async findActiveForUser(userId: string): Promise<readonly LoanReadItem[]> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<LoanReadRow>(
      `${SELECT_LOAN_FIELDS}
       WHERE p.usuario_id = $1::bigint
         AND p.estado NOT IN ('FINALIZADO'::gacor.estado_prestamo_enum, 'CANCELADO'::gacor.estado_prestamo_enum)
       ORDER BY p.fecha_hora_solicitud DESC, p.id DESC`,
      [userId],
    );
    return result.rows.map(mapLoanRow);
  }

  async findHistoryForUser(userId: string, pagination: LoanReadPagination): Promise<readonly LoanReadItem[]> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<LoanReadRow>(
      `${SELECT_LOAN_FIELDS}
       WHERE p.usuario_id = $1::bigint
       ORDER BY p.fecha_hora_solicitud DESC, p.id DESC
       LIMIT $2::integer OFFSET $3::integer`,
      [userId, pagination.limit + 1, pagination.offset],
    );
    return result.rows.map(mapLoanRow);
  }

  async findAvailableAdministrativeVehicles(pagination: LoanReadPagination): Promise<AvailableVehiclePage> {
    const result = await this.database.query<{
      vehicle_id: string; plate: string; make: string; model: string | null; latest_kilometers: string | null;
    }>(
      `SELECT available.vehiculo_id::text AS vehicle_id, available.placa AS plate,
              available.marca AS make, available.modelo AS model,
              available.ultimo_kilometraje::text AS latest_kilometers
       FROM gacor.vw_vehiculos_administrativos_disponibles available
       JOIN gacor.gabinetes cabinet ON cabinet.id=available.gabinete_id
       WHERE cabinet.estado='ONLINE'::gacor.estado_gabinete_enum
       ORDER BY available.placa, available.vehiculo_id
       LIMIT $1::integer OFFSET $2::integer`, [pagination.limit + 1, pagination.offset],
    );
    const hasMore = result.rows.length > pagination.limit;
    const rows = hasMore ? result.rows.slice(0, pagination.limit) : result.rows;
    return { items: rows.map((row) => ({
      vehicle: { id: row.vehicle_id, plate: row.plate, make: row.make, model: row.model },
      latestKilometers: row.latest_kilometers,
    })), hasMore };
  }
}

const SELECT_LOAN_FIELDS = `SELECT
  p.id::text AS id, p.estado::text AS status, p.fecha_hora_solicitud AS requested_at,
  p.fecha_hora_retiro_llave AS key_withdrawn_at, p.fecha_hora_inicio_uso AS use_started_at,
  p.fecha_hora_fin_uso AS use_ended_at, p.fecha_hora_retorno_llave AS key_returned_at,
  p.destino AS destination, p.motivo AS reason, p.observaciones_fin AS return_observations,
  v.id::text AS vehicle_id, v.placa AS vehicle_plate, v.marca AS vehicle_make,
  v.modelo AS vehicle_model, v.tipo::text AS vehicle_kind, v.estado_operativo::text AS vehicle_operational_state,
  mv.id::text AS movement_id, mv.estado::text AS movement_state,
  mv.fecha_hora_inicio AS movement_started_at, mv.fecha_hora_fin AS movement_ended_at,
  li.id::text AS initial_odometer_id, li.kilometraje::text AS initial_odometer_value,
  li.tipo_lectura::text AS initial_odometer_type, li.fecha_hora_servidor AS initial_odometer_at,
  lf.id::text AS final_odometer_id, lf.kilometraje::text AS final_odometer_value,
  lf.tipo_lectura::text AS final_odometer_type, lf.fecha_hora_servidor AS final_odometer_at
FROM gacor.prestamos_administrativos p
JOIN gacor.vehiculos v ON v.id = p.vehiculo_id
LEFT JOIN gacor.movimientos_vehiculo mv ON mv.id = p.movimiento_id
LEFT JOIN gacor.lecturas_odometro li ON li.id = mv.lectura_inicio_id
LEFT JOIN gacor.lecturas_odometro lf ON lf.id = mv.lectura_fin_id`;

function mapLoanRow(row: LoanReadRow): LoanReadItem {
  const movement = row.movement_id === null ? null : {
    id: row.movement_id,
    state: row.movement_state!,
    startedAt: dateToIso(row.movement_started_at!),
    endedAt: nullableDateToIso(row.movement_ended_at),
    initialOdometer: row.initial_odometer_id === null ? null : {
      id: row.initial_odometer_id,
      value: row.initial_odometer_value!,
      type: row.initial_odometer_type!,
      recordedAt: dateToIso(row.initial_odometer_at!),
    },
    finalOdometer: row.final_odometer_id === null ? null : {
      id: row.final_odometer_id,
      value: row.final_odometer_value!,
      type: row.final_odometer_type!,
      recordedAt: dateToIso(row.final_odometer_at!),
    },
  };
  return {
    id: row.id,
    status: row.status,
    requestedAt: dateToIso(row.requested_at),
    keyWithdrawnAt: nullableDateToIso(row.key_withdrawn_at),
    useStartedAt: nullableDateToIso(row.use_started_at),
    useEndedAt: nullableDateToIso(row.use_ended_at),
    keyReturnedAt: nullableDateToIso(row.key_returned_at),
    destination: row.destination,
    reason: row.reason,
    returnObservations: row.return_observations,
    vehicle: {
      id: row.vehicle_id,
      plate: row.vehicle_plate,
      make: row.vehicle_make,
      model: row.vehicle_model,
      kind: row.vehicle_kind,
      operationalState: row.vehicle_operational_state,
    },
    movement,
  };
}

function dateToIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function nullableDateToIso(value: Date | string | null): string | null {
  return value === null ? null : dateToIso(value);
}
