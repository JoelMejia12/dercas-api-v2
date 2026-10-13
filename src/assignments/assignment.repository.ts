import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';

export interface ActiveAssignment {
  readonly id: string;
  readonly state: 'ACTIVA';
  readonly startedAt: string;
  readonly endsAt: string | null;
  readonly vehicle: {
    readonly id: string;
    readonly plate: string;
    readonly make: string;
    readonly model: string | null;
    readonly kind: 'ADMINISTRATIVO' | 'BRIGADA';
    readonly operationalState: 'DISPONIBLE' | 'MANTENIMIENTO' | 'FUERA_SERVICIO' | 'BLOQUEADO';
    readonly brigade: { readonly id: string; readonly name: string } | null;
  };
}

export interface AssignmentItem extends Omit<ActiveAssignment, 'state'> {
  readonly state: string;
  readonly pilot: { readonly id: string; readonly name: string };
  readonly assignedBy: { readonly id: string; readonly name: string };
  readonly observations: string | null;
}
export interface AssignmentPageResult { readonly items: readonly AssignmentItem[]; readonly hasMore: boolean }

interface ActiveAssignmentRow {
  id: string;
  state: 'ACTIVA';
  started_at: Date | string;
  ends_at: Date | string | null;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string | null;
  vehicle_kind: ActiveAssignment['vehicle']['kind'];
  vehicle_operational_state: ActiveAssignment['vehicle']['operationalState'];
  brigade_id: string | null;
  brigade_name: string | null;
}
interface AssignmentRow extends ActiveAssignmentRow {
  pilot_id: string; pilot_name: string; assigned_by_id: string; assigned_by_name: string; observations: string | null;
}

@Injectable()
export class AssignmentRepository {
  constructor(private readonly database: DatabaseService) {}

  async findActiveForPilot(pilotId: string): Promise<ActiveAssignment | null> {
    assertPositiveBigintIdentifier(pilotId, 'pilotId');
    const result = await this.database.query<ActiveAssignmentRow>(
      `SELECT a.id::text AS id, a.estado::text AS state,
              a.fecha_hora_inicio AS started_at, a.fecha_hora_fin AS ends_at,
              v.id::text AS vehicle_id, v.placa AS vehicle_plate, v.marca AS vehicle_make,
              v.modelo AS vehicle_model, v.tipo::text AS vehicle_kind,
              v.estado_operativo::text AS vehicle_operational_state,
              b.id::text AS brigade_id, b.nombre AS brigade_name
       FROM gacor.asignaciones_vehiculo a
       JOIN gacor.vehiculos v ON v.id = a.vehiculo_id
       LEFT JOIN gacor.brigadas b ON b.id = v.brigada_id
       WHERE a.piloto_id = $1::bigint
         AND a.estado = 'ACTIVA'::gacor.estado_asignacion_enum
       ORDER BY a.fecha_hora_inicio DESC, a.id DESC
       LIMIT 1`,
      [pilotId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      state: row.state,
      startedAt: toIso(row.started_at),
      endsAt: row.ends_at === null ? null : toIso(row.ends_at),
      vehicle: {
        id: row.vehicle_id,
        plate: row.vehicle_plate,
        make: row.vehicle_make,
        model: row.vehicle_model,
        kind: row.vehicle_kind,
        operationalState: row.vehicle_operational_state,
        brigade: row.brigade_id !== null && row.brigade_name !== null
          ? { id: row.brigade_id, name: row.brigade_name }
          : null,
      },
    };
  }

  async findHistoryForPilot(pilotId: string, limit: number, offset: number): Promise<AssignmentPageResult> {
    assertPositiveBigintIdentifier(pilotId, 'pilotId');
    const result = await this.database.query<AssignmentRow>(
      `${SELECT_ASSIGNMENT_FIELDS} WHERE a.piloto_id=$1::bigint
       ORDER BY a.fecha_hora_inicio DESC, a.id DESC LIMIT $2::integer OFFSET $3::integer`,
      [pilotId, limit + 1, offset],
    );
    const hasMore = result.rows.length > limit;
    return { items: (hasMore ? result.rows.slice(0, limit) : result.rows).map(mapAssignment), hasMore };
  }

  async findByIdForPilot(id: string, pilotId: string): Promise<AssignmentItem | null> {
    assertPositiveBigintIdentifier(id, 'assignmentId');
    assertPositiveBigintIdentifier(pilotId, 'pilotId');
    const result = await this.database.query<AssignmentRow>(
      `${SELECT_ASSIGNMENT_FIELDS} WHERE a.id=$1::bigint AND a.piloto_id=$2::bigint`, [id, pilotId],
    );
    return result.rows[0] ? mapAssignment(result.rows[0]) : null;
  }
}

const SELECT_ASSIGNMENT_FIELDS = `SELECT a.id::text AS id, a.estado::text AS state,
       a.fecha_hora_inicio AS started_at, a.fecha_hora_fin AS ends_at,
       v.id::text AS vehicle_id, v.placa AS vehicle_plate, v.marca AS vehicle_make,
       v.modelo AS vehicle_model, v.tipo::text AS vehicle_kind,
       v.estado_operativo::text AS vehicle_operational_state,
       b.id::text AS brigade_id, b.nombre AS brigade_name,
       pilot.id::text AS pilot_id, pilot.nombres || ' ' || pilot.apellidos AS pilot_name,
       assigner.id::text AS assigned_by_id, assigner.nombres || ' ' || assigner.apellidos AS assigned_by_name,
       a.observaciones
       FROM gacor.asignaciones_vehiculo a
       JOIN gacor.vehiculos v ON v.id=a.vehiculo_id
       JOIN gacor.usuarios pilot ON pilot.id=a.piloto_id
       JOIN gacor.usuarios assigner ON assigner.id=a.asignado_por_id
       LEFT JOIN gacor.brigadas b ON b.id=v.brigada_id`;

function mapAssignment(row: AssignmentRow): AssignmentItem {
  return {
    id: row.id, state: row.state, startedAt: toIso(row.started_at), endsAt: row.ends_at === null ? null : toIso(row.ends_at),
    vehicle: {
      id: row.vehicle_id, plate: row.vehicle_plate, make: row.vehicle_make, model: row.vehicle_model,
      kind: row.vehicle_kind, operationalState: row.vehicle_operational_state,
      brigade: row.brigade_id !== null && row.brigade_name !== null ? { id: row.brigade_id, name: row.brigade_name } : null,
    },
    pilot: { id: row.pilot_id, name: row.pilot_name },
    assignedBy: { id: row.assigned_by_id, name: row.assigned_by_name },
    observations: row.observations,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
