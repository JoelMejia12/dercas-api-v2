import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { MaintenanceOrderHistoryQueryDto } from './maintenance.dto';

export interface MaintenanceDetailLine {
  readonly id: string;
  readonly maintenanceTypeId: string | null;
  readonly planId: string | null;
  readonly odometerReadingId: string | null;
  readonly description: string;
  readonly quantity: string;
  readonly partsCost: string;
  readonly laborCost: string;
  readonly otherCost: string;
  readonly nextIntervalKilometers: string | null;
  readonly nextIntervalDays: number | null;
  readonly performedAt: string;
  readonly observations: string | null;
}

export interface MaintenanceOrderRecord {
  readonly id: string;
  readonly vehicleId: string;
  readonly state: string;
  readonly blocksVehicle: boolean;
  readonly enteredAt: string;
  readonly exitedAt: string | null;
  readonly reason: string | null;
  readonly observations: string | null;
  readonly workshopId: string | null;
  readonly movementId: string | null;
  readonly detailLines?: readonly MaintenanceDetailLine[];
}

export interface MaintenancePlanStatus {
  readonly planId: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly maintenanceTypeId: string;
  readonly maintenanceName: string;
  readonly currentKilometers: string | null;
  readonly lastServiceKilometers: string | null;
  readonly intervalKilometers: string | null;
  readonly nextKilometers: string | null;
  readonly kilometersRemaining: string | null;
  readonly kilometerStatus: string;
}

export interface MaintenanceAlertRecord {
  readonly id: string;
  readonly type: string;
  readonly priority: string;
  readonly title: string;
  readonly message: string;
  readonly state: string;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export interface CreateMaintenanceOrderInput {
  readonly userId: string;
  readonly auditIp: string;
  readonly reason?: string;
  readonly observations?: string;
}

export interface MaintenanceOrderPageData {
  readonly items: readonly MaintenanceOrderRecord[];
  readonly hasMore: boolean;
}

interface MaintenanceOrderRow {
  id: string;
  vehicle_id: string;
  state: string;
  blocks_vehicle: boolean;
  entered_at: Date | string;
  exited_at: Date | string | null;
  reason: string | null;
  observations: string | null;
  workshop_id: string | null;
  movement_id: string | null;
}

interface DetailLineRow {
  id: string;
  maintenance_type_id: string | null;
  plan_id: string | null;
  odometer_reading_id: string | null;
  description: string;
  quantity: string;
  parts_cost: string;
  labor_cost: string;
  other_cost: string;
  next_interval_kilometers: string | null;
  next_interval_days: number | null;
  performed_at: Date | string;
  observations: string | null;
}

export class NoAssignedVehicleForMaintenanceError extends Error {
  constructor() { super(); this.name = 'NoAssignedVehicleForMaintenanceError'; }
}

export class ActiveBlockingMaintenanceOrderError extends Error {
  constructor() { super(); this.name = 'ActiveBlockingMaintenanceOrderError'; }
}

@Injectable()
export class MaintenanceRepository {
  constructor(private readonly database: DatabaseService) {}

  async findOrdersForCurrentVehicle(userId: string, query: MaintenanceOrderHistoryQueryDto): Promise<MaintenanceOrderPageData> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<MaintenanceOrderRow>(
      `SELECT om.id::text AS id, om.vehiculo_id::text AS vehicle_id, om.estado::text AS state,
              om.bloquea_vehiculo AS blocks_vehicle, om.fecha_hora_ingreso AS entered_at,
              om.fecha_hora_salida AS exited_at, om.motivo AS reason, om.observaciones AS observations,
              om.taller_id::text AS workshop_id, om.movimiento_id::text AS movement_id
       FROM gacor.ordenes_mantenimiento om
       WHERE om.vehiculo_id = (
         SELECT a.vehiculo_id FROM gacor.asignaciones_vehiculo a
         JOIN gacor.vehiculos v ON v.id = a.vehiculo_id AND v.activo = TRUE
         WHERE a.piloto_id = $1::bigint AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
       )
         AND ($2::text IS NULL OR om.estado::text = $2::text)
       ORDER BY om.fecha_hora_ingreso DESC, om.id DESC
       LIMIT $3::integer OFFSET $4::integer`,
      [userId, query.state ?? null, query.limit + 1, query.offset],
    );
    const hasMore = result.rows.length > query.limit;
    const rows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
    return { items: rows.map(mapOrder), hasMore };
  }

  async findOrderByIdForCurrentVehicle(id: string, userId: string): Promise<MaintenanceOrderRecord | null> {
    assertPositiveBigintIdentifier(id, 'maintenanceOrderId');
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<MaintenanceOrderRow>(
      `SELECT om.id::text AS id, om.vehiculo_id::text AS vehicle_id, om.estado::text AS state,
              om.bloquea_vehiculo AS blocks_vehicle, om.fecha_hora_ingreso AS entered_at,
              om.fecha_hora_salida AS exited_at, om.motivo AS reason, om.observaciones AS observations,
              om.taller_id::text AS workshop_id, om.movimiento_id::text AS movement_id
       FROM gacor.ordenes_mantenimiento om
       WHERE om.id = $1::bigint AND om.vehiculo_id = (
         SELECT a.vehiculo_id FROM gacor.asignaciones_vehiculo a
         JOIN gacor.vehiculos v ON v.id = a.vehiculo_id AND v.activo = TRUE
         WHERE a.piloto_id = $2::bigint AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
       )`,
      [id, userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const details = await this.database.query<DetailLineRow>(
      `SELECT id::text AS id, tipo_mantenimiento_id::text AS maintenance_type_id,
              plan_mantenimiento_id::text AS plan_id, lectura_odometro_id::text AS odometer_reading_id,
              descripcion AS description, cantidad::text AS quantity,
              costo_repuestos::text AS parts_cost, costo_mano_obra::text AS labor_cost,
              costo_otros::text AS other_cost, intervalo_proximo_km::text AS next_interval_kilometers,
              intervalo_proximo_dias AS next_interval_days, realizado_at AS performed_at,
              observaciones AS observations
       FROM gacor.detalle_mantenimiento WHERE orden_mantenimiento_id = $1::bigint
       ORDER BY realizado_at ASC, id ASC`,
      [id],
    );
    return { ...mapOrder(row), detailLines: details.rows.map(mapDetailLine) };
  }

  async findPlansForCurrentVehicle(userId: string): Promise<readonly MaintenancePlanStatus[]> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<{
      plan_id: string; vehicle_id: string; plate: string; maintenance_type_id: string; maintenance_name: string;
      current_kilometers: string | null; last_service_kilometers: string | null; interval_kilometers: string | null;
      next_kilometers: string | null; kilometers_remaining: string | null; kilometer_status: string;
    }>(
      `SELECT em.plan_id::text AS plan_id, em.vehiculo_id::text AS vehicle_id, em.placa AS plate,
              em.tipo_mantenimiento_id::text AS maintenance_type_id, em.mantenimiento AS maintenance_name,
              em.kilometraje_actual::text AS current_kilometers,
              em.kilometraje_ultimo_servicio::text AS last_service_kilometers,
              em.intervalo_km::text AS interval_kilometers, em.proximo_kilometraje::text AS next_kilometers,
              em.kilometros_restantes::text AS kilometers_remaining, em.estado_km AS kilometer_status
       FROM gacor.vw_estado_mantenimiento em
       WHERE em.vehiculo_id = (
         SELECT a.vehiculo_id FROM gacor.asignaciones_vehiculo a
         JOIN gacor.vehiculos v ON v.id = a.vehiculo_id AND v.activo = TRUE
         WHERE a.piloto_id = $1::bigint AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
       )
       ORDER BY em.mantenimiento ASC, em.plan_id ASC`,
      [userId],
    );
    return result.rows.map((row) => ({
      planId: row.plan_id, vehicleId: row.vehicle_id, plate: row.plate,
      maintenanceTypeId: row.maintenance_type_id, maintenanceName: row.maintenance_name,
      currentKilometers: row.current_kilometers, lastServiceKilometers: row.last_service_kilometers,
      intervalKilometers: row.interval_kilometers, nextKilometers: row.next_kilometers,
      kilometersRemaining: row.kilometers_remaining, kilometerStatus: row.kilometer_status,
    }));
  }

  async findAlertsForCurrentVehicle(userId: string): Promise<readonly MaintenanceAlertRecord[]> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<{
      id: string; type: string; priority: string; title: string; message: string;
      state: string; created_at: Date | string; resolved_at: Date | string | null;
    }>(
      `SELECT al.id::text AS id, al.tipo AS type, al.prioridad::text AS priority,
              al.titulo AS title, al.mensaje AS message, al.estado::text AS state,
              al.created_at, al.resolved_at
       FROM gacor.alertas al
       WHERE al.vehiculo_id = (
         SELECT a.vehiculo_id FROM gacor.asignaciones_vehiculo a
         JOIN gacor.vehiculos v ON v.id = a.vehiculo_id AND v.activo = TRUE
         WHERE a.piloto_id = $1::bigint AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
       )
         AND al.tipo IN ('MANTENIMIENTO_PROXIMO', 'MANTENIMIENTO_VENCIDO')
       ORDER BY al.created_at DESC, al.id DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: row.id, type: row.type, priority: row.priority, title: row.title, message: row.message,
      state: row.state, createdAt: toIso(row.created_at), resolvedAt: row.resolved_at === null ? null : toIso(row.resolved_at),
    }));
  }

  async createOrder(input: CreateMaintenanceOrderInput): Promise<MaintenanceOrderRecord> {
    assertPositiveBigintIdentifier(input.userId, 'userId');
    if (isIP(input.auditIp) === 0) throw new TypeError('Invalid value for auditIp');
    try {
      return await this.database.transaction(async (tx) => {
        const result = await tx.query<MaintenanceOrderRow>(
          `WITH assigned_vehicle AS (
             SELECT a.vehiculo_id
             FROM gacor.asignaciones_vehiculo a
             JOIN gacor.vehiculos v ON v.id = a.vehiculo_id AND v.activo = TRUE
             WHERE a.piloto_id = $1::bigint AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
             FOR UPDATE OF a, v
           )
           INSERT INTO gacor.ordenes_mantenimiento (vehiculo_id, ingresado_por_id, motivo, observaciones)
           SELECT assigned_vehicle.vehiculo_id, $1::bigint, $2, $3
           FROM assigned_vehicle
           RETURNING id::text AS id, vehiculo_id::text AS vehicle_id, estado::text AS state,
                     bloquea_vehiculo AS blocks_vehicle, fecha_hora_ingreso AS entered_at,
                     fecha_hora_salida AS exited_at, motivo AS reason, observaciones AS observations,
                     taller_id::text AS workshop_id, movimiento_id::text AS movement_id`,
          [input.userId, input.reason ?? null, input.observations ?? null],
        );
        if (!result.rows[0]) throw new NoAssignedVehicleForMaintenanceError();
        return mapOrder(result.rows[0]);
      }, { userId: input.userId, ip: input.auditIp });
    } catch (error) {
      if (isActiveBlockingOrderConflict(error)) throw new ActiveBlockingMaintenanceOrderError();
      throw error;
    }
  }
}

function mapOrder(row: MaintenanceOrderRow): MaintenanceOrderRecord {
  return {
    id: row.id, vehicleId: row.vehicle_id, state: row.state, blocksVehicle: row.blocks_vehicle,
    enteredAt: toIso(row.entered_at), exitedAt: row.exited_at === null ? null : toIso(row.exited_at),
    reason: row.reason, observations: row.observations, workshopId: row.workshop_id, movementId: row.movement_id,
  };
}

function mapDetailLine(row: DetailLineRow): MaintenanceDetailLine {
  return {
    id: row.id, maintenanceTypeId: row.maintenance_type_id, planId: row.plan_id,
    odometerReadingId: row.odometer_reading_id, description: row.description, quantity: row.quantity,
    partsCost: row.parts_cost, laborCost: row.labor_cost, otherCost: row.other_cost,
    nextIntervalKilometers: row.next_interval_kilometers, nextIntervalDays: row.next_interval_days,
    performedAt: toIso(row.performed_at), observations: row.observations,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isActiveBlockingOrderConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const postgresError = error as { code?: unknown; constraint?: unknown };
  return postgresError.code === '23505' && postgresError.constraint === 'uq_orden_bloqueante_activa_vehiculo';
}
