import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { assertPositiveBigintIdentifier } from '../database/postgres-values';
import { UsersListQueryDto } from './users.dto';

export interface UserProfile {
  readonly id: string;
  readonly employeeCode: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly title: string | null;
  readonly department: string | null;
  readonly phone: string | null;
  readonly profilePhotoUrl: string | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface EffectiveRole { readonly id: string; readonly code: string; readonly name: string }
export interface EffectivePermission { readonly id: string; readonly code: string; readonly name: string }
export interface UserAccess { readonly roles: readonly EffectiveRole[]; readonly permissions: readonly EffectivePermission[] }

interface UserRow { id: string; employee_code: string | null; first_name: string; last_name: string; email: string; title: string | null; department: string | null; phone: string | null; photo_url: string | null; active: boolean; created_at: Date | string; updated_at: Date | string }
interface AccessRow { roles: EffectiveRole[] | string; permissions: EffectivePermission[] | string }

const USER_FIELDS = `id::text AS id, codigo_empleado AS employee_code, nombres AS first_name,
  apellidos AS last_name, correo AS email, puesto AS title, departamento AS department,
  telefono AS phone, foto_perfil_url AS photo_url, activo AS active, created_at, updated_at`;

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  async findProfile(userId: string): Promise<UserProfile | null> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<UserRow>(`SELECT ${USER_FIELDS} FROM gacor.usuarios WHERE id = $1::bigint`, [userId]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findAccess(userId: string): Promise<UserAccess | null> {
    assertPositiveBigintIdentifier(userId, 'userId');
    const result = await this.database.query<AccessRow>(
      `SELECT
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id::text, 'code', r.codigo, 'name', r.nombre) ORDER BY r.codigo)
          FROM gacor.usuario_rol ur JOIN gacor.roles r ON r.id = ur.rol_id
          WHERE ur.usuario_id = u.id AND r.activo = TRUE), '[]'::jsonb) AS roles,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id', effective.id::text, 'code', effective.codigo, 'name', effective.nombre) ORDER BY effective.codigo)
          FROM (SELECT DISTINCT p.id, p.codigo, p.nombre
            FROM gacor.usuario_rol ur JOIN gacor.roles r ON r.id = ur.rol_id AND r.activo = TRUE
            JOIN gacor.rol_permiso rp ON rp.rol_id = r.id
            JOIN gacor.permisos p ON p.id = rp.permiso_id AND p.activo = TRUE
            WHERE ur.usuario_id = u.id) effective), '[]'::jsonb) AS permissions
       FROM gacor.usuarios u WHERE u.id = $1::bigint`, [userId]);
    const row = result.rows[0];
    if (!row) return null;
    return { roles: parseJsonArray<EffectiveRole>(row.roles), permissions: parseJsonArray<EffectivePermission>(row.permissions) };
  }

  async findUsers(query: UsersListQueryDto): Promise<{ items: readonly UserProfile[]; hasMore: boolean }> {
    const result = await this.database.query<UserRow>(
      `SELECT ${USER_FIELDS} FROM gacor.usuarios
       WHERE ($1::boolean IS NULL OR activo = $1::boolean)
         AND ($2::text IS NULL OR nombres ILIKE '%' || $2 || '%' OR apellidos ILIKE '%' || $2 || '%'
              OR correo ILIKE '%' || $2 || '%' OR codigo_empleado ILIKE '%' || $2 || '%')
       ORDER BY apellidos ASC, nombres ASC, id ASC
       LIMIT $3::integer OFFSET $4::integer`,
      [query.active ?? null, query.q || null, query.limit + 1, query.offset],
    );
    const hasMore = result.rows.length > query.limit;
    return { items: (hasMore ? result.rows.slice(0, query.limit) : result.rows).map(mapUser), hasMore };
  }

  async findUserById(id: string): Promise<UserProfile | null> {
    assertPositiveBigintIdentifier(id, 'userId');
    const result = await this.database.query<UserRow>(`SELECT ${USER_FIELDS} FROM gacor.usuarios WHERE id = $1::bigint`, [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }
}

function mapUser(row: UserRow): UserProfile {
  return { id: row.id, employeeCode: row.employee_code, firstName: row.first_name, lastName: row.last_name,
    email: row.email, title: row.title, department: row.department, phone: row.phone, profilePhotoUrl: row.photo_url,
    active: row.active, createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at) };
}
function toIso(value: Date | string): string { return new Date(value).toISOString(); }
function parseJsonArray<T>(value: T[] | string): T[] { return typeof value === 'string' ? JSON.parse(value) as T[] : value; }
