import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PgQueryable } from '../database/pg-queryable';
import { SessionRecord } from './auth.types';

interface UserRow { id: string; correo: string; password_hash: string; activo: boolean }
interface DeviceRow { id: string; device_token_hash: string; activo: boolean }
interface IdentityRow { id: string; usuario_id: string; dispositivo_id: string; estado: string }

export class AuthIdentityChangedError extends Error {
  constructor() { super('Authentication identity changed during login'); this.name = 'AuthIdentityChangedError'; }
}

@Injectable()
export class AuthRepository {
  constructor(private readonly database: DatabaseService) {}

  async findUser(email: string): Promise<UserRow | undefined> {
    const result = await this.database.query<UserRow>('SELECT id::text, correo, password_hash, activo FROM gacor.usuarios WHERE correo = $1 LIMIT 1', [email]);
    return result.rows[0];
  }

  async findDevice(id: string): Promise<DeviceRow | undefined> {
    const result = await this.database.query<DeviceRow>('SELECT id::text, device_token_hash, activo FROM gacor.dispositivos WHERE id = $1::bigint LIMIT 1', [id]);
    return result.rows[0];
  }

  createSession(userId: string, deviceId: string, refreshHash: string, ip: string | undefined,
    expectedPasswordHash: string, expectedDeviceTokenHash: string): Promise<IdentityRow> {
    return this.database.transaction(async (tx) => {
      const identity = await tx.query(
        `SELECT u.id FROM gacor.usuarios u CROSS JOIN gacor.dispositivos d
         WHERE u.id = $1::bigint AND d.id = $2::bigint AND u.activo = TRUE AND d.activo = TRUE
           AND u.password_hash = $3 AND d.device_token_hash = $4
         FOR SHARE OF u, d`,
        [userId, deviceId, expectedPasswordHash, expectedDeviceTokenHash],
      );
      if (identity.rowCount !== 1) throw new AuthIdentityChangedError();
      // Expired sessions have no dedicated enum state. Close them so the partial
      // unique index for one ABIERTA session per device does not strand devices.
      await tx.query(
        `UPDATE gacor.sesiones_dispositivo SET estado = 'CERRADA'::gacor.estado_sesion_dispositivo_enum,
           logout_at = NOW(), refresh_token_hash = NULL
         WHERE dispositivo_id = $1::bigint AND estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum
           AND login_at <= NOW() - ($2::integer * INTERVAL '1 second')`,
        [deviceId, 2_592_000],
      );
      const result = await tx.query<IdentityRow>(
        `INSERT INTO gacor.sesiones_dispositivo (dispositivo_id, usuario_id, estado, refresh_token_hash, ip_login)
         VALUES ($1::bigint, $2::bigint, 'ABIERTA'::gacor.estado_sesion_dispositivo_enum, $3, $4::inet) RETURNING id::text, usuario_id::text, dispositivo_id::text, estado`,
        [deviceId, userId, refreshHash, ip ?? null],
      );
      await tx.query('UPDATE gacor.usuarios SET ultimo_acceso_at = NOW() WHERE id = $1::bigint AND activo = TRUE', [userId]);
      return result.rows[0]!;
    });
  }

  async findRefreshSession(sessionId: string, refreshHash: string, maxAgeSeconds: number): Promise<SessionRecord | undefined> {
    const result = await this.database.query<SessionRecord>(
      `SELECT s.id::text, s.usuario_id::text, s.dispositivo_id::text, s.estado, s.login_at, s.refresh_token_hash
       FROM gacor.sesiones_dispositivo s
       JOIN gacor.usuarios u ON u.id = s.usuario_id
       JOIN gacor.dispositivos d ON d.id = s.dispositivo_id
       WHERE s.id = $1::bigint AND s.refresh_token_hash = $2 AND s.estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum
         AND s.login_at > NOW() - ($3::integer * INTERVAL '1 second') AND u.activo = TRUE AND d.activo = TRUE`,
      [sessionId, refreshHash, maxAgeSeconds],
    );
    return result.rows[0];
  }

  rotateRefresh(sessionId: string, oldHash: string, newHash: string, maxAgeSeconds: number): Promise<boolean> {
    return this.database.transaction(async (tx) => {
      const result = await tx.query(
        `UPDATE gacor.sesiones_dispositivo s SET refresh_token_hash = $3
         FROM gacor.usuarios u, gacor.dispositivos d
         WHERE s.id = $1::bigint AND s.refresh_token_hash = $2 AND s.estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum
           AND s.usuario_id = u.id AND s.dispositivo_id = d.id AND u.activo = TRUE AND d.activo = TRUE
           AND s.login_at > NOW() - ($4::integer * INTERVAL '1 second')`,
        [sessionId, oldHash, newHash, maxAgeSeconds],
      );
      return result.rowCount === 1;
    });
  }

  async revoke(sessionId: string, userId: string, ip: string | undefined): Promise<void> {
    await this.database.query(
      `UPDATE gacor.sesiones_dispositivo SET estado = 'REVOCADA'::gacor.estado_sesion_dispositivo_enum,
         logout_at = COALESCE(logout_at, NOW()), refresh_token_hash = NULL, ip_logout = $3::inet
       WHERE id = $1::bigint AND usuario_id = $2::bigint AND estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum`,
      [sessionId, userId, ip ?? null],
    );
  }

  async closeSession(sessionId: string, userId: string, ip: string | undefined): Promise<void> {
    await this.database.query(
      `UPDATE gacor.sesiones_dispositivo SET estado = 'CERRADA'::gacor.estado_sesion_dispositivo_enum,
         logout_at = COALESCE(logout_at, NOW()), refresh_token_hash = NULL, ip_logout = $3::inet
       WHERE id = $1::bigint AND usuario_id = $2::bigint AND estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum`,
      [sessionId, userId, ip ?? null],
    );
  }

  async findActivePrincipal(userId: string, sessionId: string, deviceId: string): Promise<readonly string[] | undefined> {
    const session = await this.database.query(
      `SELECT 1 FROM gacor.sesiones_dispositivo s
       JOIN gacor.usuarios u ON u.id = s.usuario_id JOIN gacor.dispositivos d ON d.id = s.dispositivo_id
       WHERE s.id = $1::bigint AND s.usuario_id = $2::bigint AND s.dispositivo_id = $3::bigint
         AND s.estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum AND u.activo = TRUE AND d.activo = TRUE
         AND s.login_at > NOW() - ($4::integer * INTERVAL '1 second') LIMIT 1`,
      [sessionId, userId, deviceId, 2_592_000],
    );
    if (session.rowCount !== 1) return undefined;
    const grants = await this.database.query<{ codigo: string }>(
      `SELECT DISTINCT p.codigo FROM gacor.usuario_rol ur
       JOIN gacor.roles r ON r.id = ur.rol_id AND r.activo = TRUE
       JOIN gacor.rol_permiso rp ON rp.rol_id = r.id
       JOIN gacor.permisos p ON p.id = rp.permiso_id AND p.activo = TRUE
       WHERE ur.usuario_id = $1::bigint ORDER BY p.codigo`, [userId],
    );
    return grants.rows.map((row) => row.codigo);
  }
}

export type { PgQueryable };
