import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { VehiclePageQueryDto } from './vehicle-query.dto';

export interface VehicleSummary {
  readonly id: string;
  readonly plate: string;
  readonly make: string;
  readonly model: string | null;
  readonly kind: 'ADMINISTRATIVO' | 'BRIGADA';
  readonly operationalState: 'DISPONIBLE' | 'MANTENIMIENTO' | 'FUERA_SERVICIO' | 'BLOQUEADO';
}

export interface AssignedVehicle {
  readonly id: string;
  readonly plate: string;
  readonly make: string;
  readonly model: string | null;
  readonly kind: 'ADMINISTRATIVO' | 'BRIGADA';
  readonly operationalState: 'DISPONIBLE' | 'MANTENIMIENTO' | 'FUERA_SERVICIO' | 'BLOQUEADO';
  readonly brigade: { readonly id: string; readonly name: string } | null;
  readonly assignment: { readonly id: string; readonly startedAt: string };
  readonly odometer: { readonly value: string; readonly recordedAt: string } | null;
}

export interface AdministrativeAvailableVehicle {
  readonly id: string;
  readonly plate: string;
  readonly make: string;
  readonly model: string | null;
  readonly cabinetId: string;
  readonly positionId: string;
  readonly positionNumber: number;
  readonly latestOdometer: string | null;
}

export interface VehicleAssignmentHistoryItem {
  readonly id: string;
  readonly vehicle: { readonly id: string; readonly plate: string; readonly make: string; readonly model: string | null; readonly kind: string; readonly brigade: { readonly id: string; readonly name: string } | null };
  readonly state: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly observations: string | null;
}

export interface VehicleMaintenanceStatus {
  readonly planId: string;
  readonly vehicleId: string;
  readonly plate: string;
  readonly maintenanceTypeId: string;
  readonly maintenance: string;
  readonly currentKilometers: string | null;
  readonly lastServiceKilometers: string | null;
  readonly intervalKilometers: string | null;
  readonly nextKilometers: string | null;
  readonly kilometersRemaining: string | null;
  readonly kilometerState: string;
}

interface VehicleSummaryRow {
  id: string;
  placa: string;
  marca: string;
  modelo: string | null;
  tipo: VehicleSummary['kind'];
  estado_operativo: VehicleSummary['operationalState'];
}

interface AssignedVehicleRow {
  id: string;
  placa: string;
  marca: string;
  modelo: string | null;
  tipo: AssignedVehicle['kind'];
  estado_operativo: AssignedVehicle['operationalState'];
  brigada_id: string | null;
  brigada_nombre: string | null;
  asignacion_id: string;
  asignacion_inicio: Date | string;
  kilometraje: string | null;
  kilometraje_at: Date | string | null;
}

interface AvailableVehicleRow { vehicle_id: string; plate: string; make: string; model: string | null; cabinet_id: string; position_id: string; position_number: number; latest_odometer: string | null }
interface AssignmentHistoryRow { id: string; vehicle_id: string; plate: string; make: string; model: string | null; kind: string; brigade_id: string | null; brigade_name: string | null; state: string; started_at: Date | string; ended_at: Date | string | null; observations: string | null }
interface MaintenanceStatusRow { plan_id: string; vehicle_id: string; plate: string; maintenance_type_id: string; maintenance: string; current_kilometers: string | null; last_service_kilometers: string | null; interval_kilometers: string | null; next_kilometers: string | null; kilometers_remaining: string | null; kilometer_state: string }

@Injectable()
export class VehicleRepository {
  constructor(private readonly database: DatabaseService) {}

  async findSummaryById(id: string): Promise<VehicleSummary | null> {
    assertPositiveBigintIdentifier(id, 'vehicleId');
    const result = await this.database.query<VehicleSummaryRow>(
      `SELECT id, placa, marca, modelo, tipo, estado_operativo
       FROM gacor.vehiculos
       WHERE id = $1 AND activo = TRUE`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      plate: row.placa,
      make: row.marca,
      model: row.modelo,
      kind: row.tipo,
      operationalState: row.estado_operativo,
    };
  }

  async findActiveAssignedToUser(userId: string): Promise<AssignedVehicle | null> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<AssignedVehicleRow>(
      `SELECT v.id::text, v.placa, v.marca, v.modelo, v.tipo, v.estado_operativo,
              b.id::text AS brigada_id, b.nombre AS brigada_nombre,
              a.id::text AS asignacion_id, a.fecha_hora_inicio AS asignacion_inicio,
              uk.kilometraje::text AS kilometraje, uk.fecha_hora_servidor AS kilometraje_at
       FROM gacor.asignaciones_vehiculo a
       JOIN gacor.vehiculos v ON v.id = a.vehiculo_id AND v.activo = TRUE
       LEFT JOIN gacor.brigadas b ON b.id = v.brigada_id
       LEFT JOIN gacor.vw_ultimo_kilometraje_vehiculo uk ON uk.vehiculo_id = v.id
       WHERE a.piloto_id = $1::bigint
         AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
       LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      plate: row.placa,
      make: row.marca,
      model: row.modelo,
      kind: row.tipo,
      operationalState: row.estado_operativo,
      brigade: row.brigada_id && row.brigada_nombre ? { id: row.brigada_id, name: row.brigada_nombre } : null,
      assignment: { id: row.asignacion_id, startedAt: new Date(row.asignacion_inicio).toISOString() },
      odometer: row.kilometraje !== null && row.kilometraje_at !== null
        ? { value: row.kilometraje, recordedAt: new Date(row.kilometraje_at).toISOString() }
        : null,
    };
  }

  async findAdministrativeAvailable(query: VehiclePageQueryDto): Promise<{ items: readonly AdministrativeAvailableVehicle[]; hasMore: boolean }> {
    if (query.cabinetId !== undefined) assertPositiveBigintIdentifier(query.cabinetId, 'cabinetId');
    const result = await this.database.query<AvailableVehicleRow>(
      `SELECT vehiculo_id::text AS vehicle_id, placa AS plate, marca AS make, modelo AS model,
              gabinete_id::text AS cabinet_id, posicion_id::text AS position_id,
              numero_posicion AS position_number, ultimo_kilometraje::text AS latest_odometer
       FROM gacor.vw_vehiculos_administrativos_disponibles
       WHERE ($1::bigint IS NULL OR gabinete_id = $1::bigint)
       ORDER BY vehiculo_id ASC LIMIT $2::integer OFFSET $3::integer`,
      [query.cabinetId ?? null, query.limit + 1, query.offset],
    );
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map((r) => ({
      id: r.vehicle_id, plate: r.plate, make: r.make, model: r.model, cabinetId: r.cabinet_id,
      positionId: r.position_id, positionNumber: r.position_number, latestOdometer: r.latest_odometer,
    })), hasMore };
  }

  async findAdministrativeAvailableById(id: string): Promise<AdministrativeAvailableVehicle | null> {
    assertPositiveBigintIdentifier(id, 'vehicleId');
    const result = await this.database.query<AvailableVehicleRow>(
      `SELECT vehiculo_id::text AS vehicle_id, placa AS plate, marca AS make, modelo AS model,
              gabinete_id::text AS cabinet_id, posicion_id::text AS position_id,
              numero_posicion AS position_number, ultimo_kilometraje::text AS latest_odometer
       FROM gacor.vw_vehiculos_administrativos_disponibles WHERE vehiculo_id = $1::bigint`, [id]);
    const r = result.rows[0];
    return r ? { id: r.vehicle_id, plate: r.plate, make: r.make, model: r.model, cabinetId: r.cabinet_id,
      positionId: r.position_id, positionNumber: r.position_number, latestOdometer: r.latest_odometer } : null;
  }

  async findAssignmentHistoryForUser(userId: string): Promise<readonly VehicleAssignmentHistoryItem[]> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<AssignmentHistoryRow>(
      `SELECT a.id::text AS id, v.id::text AS vehicle_id, v.placa AS plate, v.marca AS make,
              v.modelo AS model, v.tipo::text AS kind, b.id::text AS brigade_id, b.nombre AS brigade_name,
              a.estado::text AS state, a.fecha_hora_inicio AS started_at, a.fecha_hora_fin AS ended_at,
              a.observaciones
       FROM gacor.asignaciones_vehiculo a JOIN gacor.vehiculos v ON v.id = a.vehiculo_id
       LEFT JOIN gacor.brigadas b ON b.id = v.brigada_id
       WHERE a.piloto_id = $1::bigint ORDER BY a.fecha_hora_inicio DESC, a.id DESC`, [userId]);
    return result.rows.map((r) => ({ id: r.id, vehicle: { id: r.vehicle_id, plate: r.plate, make: r.make, model: r.model,
      kind: r.kind, brigade: r.brigade_id === null ? null : { id: r.brigade_id, name: r.brigade_name! } },
      state: r.state, startedAt: new Date(r.started_at).toISOString(),
      endedAt: r.ended_at === null ? null : new Date(r.ended_at).toISOString(), observations: r.observations }));
  }

  async findMaintenanceStatusForUser(userId: string): Promise<readonly VehicleMaintenanceStatus[]> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<MaintenanceStatusRow>(
      `SELECT em.plan_id::text AS plan_id, em.vehiculo_id::text AS vehicle_id, em.placa AS plate,
              em.tipo_mantenimiento_id::text AS maintenance_type_id, em.mantenimiento AS maintenance,
              em.kilometraje_actual::text AS current_kilometers,
              em.kilometraje_ultimo_servicio::text AS last_service_kilometers,
              em.intervalo_km::text AS interval_kilometers, em.proximo_kilometraje::text AS next_kilometers,
              em.kilometros_restantes::text AS kilometers_remaining, em.estado_km AS kilometer_state
       FROM gacor.asignaciones_vehiculo a JOIN gacor.vw_estado_mantenimiento em ON em.vehiculo_id = a.vehiculo_id
       WHERE a.piloto_id = $1::bigint AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
       ORDER BY em.plan_id ASC`, [userId]);
    return result.rows.map((r) => ({ planId: r.plan_id, vehicleId: r.vehicle_id, plate: r.plate,
      maintenanceTypeId: r.maintenance_type_id, maintenance: r.maintenance,
      currentKilometers: r.current_kilometers, lastServiceKilometers: r.last_service_kilometers,
      intervalKilometers: r.interval_kilometers, nextKilometers: r.next_kilometers,
      kilometersRemaining: r.kilometers_remaining, kilometerState: r.kilometer_state }));
  }
}
