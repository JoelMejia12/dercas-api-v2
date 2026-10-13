import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { CabinetEventQueryDto, CabinetListQueryDto } from './cabinet.dto';

export interface CabinetRecord { readonly id: string; readonly name: string; readonly location: string | null; readonly state: string; readonly lastConnectionAt: string | null; readonly createdAt: string; readonly updatedAt: string }
export interface CabinetPositionRecord { readonly id: string; readonly cabinetId: string; readonly number: number; readonly state: string; readonly lastReadAt: string | null; readonly keyring: null | { readonly id: string; readonly state: string; readonly active: boolean; readonly vehicle: { readonly id: string; readonly plate: string; readonly make: string; readonly model: string | null; readonly operationalState: string } } }
export interface CabinetKeyringRecord { readonly id: string; readonly vehicleId: string; readonly chipUid: string; readonly state: string; readonly active: boolean; readonly vehicle: { readonly plate: string; readonly make: string; readonly model: string | null; readonly operationalState: string }; readonly position: null | { readonly id: string; readonly cabinetId: string; readonly number: number; readonly state: string } }
export interface CabinetEventRecord { readonly id: string; readonly cabinetId: string; readonly positionId: string | null; readonly keyringId: string | null; readonly vehicleId: string | null; readonly userId: string | null; readonly loanId: string | null; readonly type: string; readonly occurredAt: string; readonly chipRead: string | null; readonly result: boolean; readonly detail: unknown | null; readonly createdAt: string }

interface CabinetRow { id: string; name: string; location: string | null; state: string; last_connection_at: Date | string | null; created_at: Date | string; updated_at: Date | string }
interface PositionRow { id: string | null; cabinet_id: string; number: number | null; state: string | null; last_read_at: Date | string | null; keyring_id: string | null; keyring_state: string | null; keyring_active: boolean | null; vehicle_id: string | null; plate: string | null; make: string | null; model: string | null; operational_state: string | null }
interface KeyringRow { id: string; vehicle_id: string; chip_uid: string; state: string; active: boolean; plate: string; make: string; model: string | null; operational_state: string; position_id: string | null; cabinet_id: string | null; position_number: number | null; position_state: string | null }
interface EventRow { id: string; cabinet_id: string; position_id: string | null; keyring_id: string | null; vehicle_id: string | null; user_id: string | null; loan_id: string | null; type: string; occurred_at: Date | string; chip_read: string | null; result: boolean; detail: unknown | null; created_at: Date | string }

@Injectable()
export class CabinetRepository {
  constructor(private readonly database: DatabaseService) {}

  async findCabinets(query: CabinetListQueryDto): Promise<{ items: readonly CabinetRecord[]; hasMore: boolean }> {
    const result = await this.database.query<CabinetRow>(`SELECT id::text AS id, nombre AS name, ubicacion AS location, estado::text AS state, ultima_conexion_at AS last_connection_at, created_at, updated_at FROM gacor.gabinetes ORDER BY id ASC LIMIT $1::integer OFFSET $2::integer`, [query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map((r) => ({ id: r.id, name: r.name, location: r.location, state: r.state, lastConnectionAt: nullableIso(r.last_connection_at), createdAt: toIso(r.created_at), updatedAt: toIso(r.updated_at) })), hasMore };
  }

  async findPositions(cabinetId: string): Promise<CabinetPositionRecord[] | null> {
    assertPositiveBigintIdentifier(cabinetId, 'cabinetId');
    const result = await this.database.query<PositionRow>(`SELECT p.id::text AS id, p.gabinete_id::text AS cabinet_id, p.numero_posicion AS number, p.estado::text AS state, p.ultima_lectura_at AS last_read_at, l.id::text AS keyring_id, l.estado::text AS keyring_state, l.activo AS keyring_active, v.id::text AS vehicle_id, v.placa AS plate, v.marca AS make, v.modelo AS model, v.estado_operativo::text AS operational_state FROM gacor.gabinetes g LEFT JOIN gacor.posiciones_gabinete p ON p.gabinete_id = g.id LEFT JOIN gacor.llaveros l ON l.id = p.llavero_actual_id LEFT JOIN gacor.vehiculos v ON v.id = l.vehiculo_id WHERE g.id = $1::bigint ORDER BY p.numero_posicion ASC, p.id ASC`, [cabinetId]);
    if (!result.rows.length) return null;
    return result.rows.flatMap((r) => r.id === null ? [] : [{ id: r.id, cabinetId: r.cabinet_id, number: r.number!, state: r.state!, lastReadAt: nullableIso(r.last_read_at), keyring: r.keyring_id === null ? null : { id: r.keyring_id, state: r.keyring_state!, active: r.keyring_active!, vehicle: { id: r.vehicle_id!, plate: r.plate!, make: r.make!, model: r.model, operationalState: r.operational_state! } } }]);
  }

  async findKeyrings(query: CabinetListQueryDto): Promise<{ items: readonly CabinetKeyringRecord[]; hasMore: boolean }> {
    const result = await this.database.query<KeyringRow>(`SELECT l.id::text AS id, l.vehiculo_id::text AS vehicle_id, l.chip_uid, l.estado::text AS state, l.activo AS active, v.placa AS plate, v.marca AS make, v.modelo AS model, v.estado_operativo::text AS operational_state, p.id::text AS position_id, p.gabinete_id::text AS cabinet_id, p.numero_posicion AS position_number, p.estado::text AS position_state FROM gacor.llaveros l JOIN gacor.vehiculos v ON v.id = l.vehiculo_id LEFT JOIN gacor.posiciones_gabinete p ON p.llavero_actual_id = l.id ORDER BY l.id ASC LIMIT $1::integer OFFSET $2::integer`, [query.limit + 1, query.offset]);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map((r) => ({ id: r.id, vehicleId: r.vehicle_id, chipUid: r.chip_uid, state: r.state, active: r.active, vehicle: { plate: r.plate, make: r.make, model: r.model, operationalState: r.operational_state }, position: r.position_id === null ? null : { id: r.position_id, cabinetId: r.cabinet_id!, number: r.position_number!, state: r.position_state! } })), hasMore };
  }

  async findEvents(query: CabinetEventQueryDto): Promise<{ items: readonly CabinetEventRecord[]; hasMore: boolean }> {
    const filters: string[] = []; const values: unknown[] = [];
    const addId = (column: string, value: string | undefined) => { if (value !== undefined) { assertPositiveBigintIdentifier(value, column); values.push(value); filters.push(`${column} = $${values.length}::bigint`); } };
    addId('eg.gabinete_id', query.cabinetId); addId('eg.posicion_id', query.positionId); addId('eg.llavero_id', query.keyringId); addId('eg.vehiculo_id', query.vehicleId); addId('eg.usuario_id', query.userId); addId('eg.prestamo_id', query.loanId);
    if (query.type !== undefined) { values.push(query.type); filters.push(`eg.tipo_evento::text = $${values.length}::text`); }
    if (query.result !== undefined) { values.push(query.result); filters.push(`eg.resultado = $${values.length}::boolean`); }
    values.push(query.limit + 1); const limitParam = values.length; values.push(query.offset); const offsetParam = values.length;
    const result = await this.database.query<EventRow>(`SELECT eg.id::text AS id, eg.gabinete_id::text AS cabinet_id, eg.posicion_id::text AS position_id, eg.llavero_id::text AS keyring_id, eg.vehiculo_id::text AS vehicle_id, eg.usuario_id::text AS user_id, eg.prestamo_id::text AS loan_id, eg.tipo_evento::text AS type, eg.fecha_hora AS occurred_at, eg.chip_leido AS chip_read, eg.resultado AS result, eg.detalle AS detail, eg.created_at FROM gacor.eventos_gabinete eg ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY eg.fecha_hora DESC, eg.id DESC LIMIT $${limitParam}::integer OFFSET $${offsetParam}::integer`, values);
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map((r) => ({ id: r.id, cabinetId: r.cabinet_id, positionId: r.position_id, keyringId: r.keyring_id, vehicleId: r.vehicle_id, userId: r.user_id, loanId: r.loan_id, type: r.type, occurredAt: toIso(r.occurred_at), chipRead: r.chip_read, result: r.result, detail: r.detail, createdAt: toIso(r.created_at) })), hasMore };
  }
}

function toIso(value: Date | string): string { return new Date(value).toISOString(); }
function nullableIso(value: Date | string | null): string | null { return value === null ? null : toIso(value); }
