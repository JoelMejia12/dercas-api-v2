import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { DatabaseService } from '../../src/database/database.service';
import { SecureLogger } from '../../src/common/logging/secure-logger.service';
import { NotificationsRepository } from '../../src/notifications/notifications.repository';
import { VehicleRepository } from '../../src/vehicles/vehicle.repository';

const explicitlyEnabled = process.env.RUN_PG_INTEGRATION === '1';
const fixtureIds = {
  userA: process.env.PG_INTEGRATION_USER_A_ID,
  userB: process.env.PG_INTEGRATION_USER_B_ID,
  notificationB: process.env.PG_INTEGRATION_NOTIFICATION_B_ID,
};
const hasAuthorizationFixture = Object.values(fixtureIds).every((value) => value !== undefined);

let pool: Pool | undefined;
let database: DatabaseService | undefined;

describe.skipIf(!explicitlyEnabled)('PostgreSQL integration (explicit opt-in)', () => {
  beforeAll(async () => {
    const connection = integrationConnection();
    pool = new Pool({
      connectionString: connection.url,
      ssl: connection.sslMode === 'verify-full' ? { rejectUnauthorized: true } : false,
      max: 1,
      application_name: 'dercas-integration-tests',
      connectionTimeoutMillis: 5_000,
    });
    database = new DatabaseService(pool, { error: () => undefined } as unknown as SecureLogger);

    const result = await pool.query<{ database_name: string }>('SELECT current_database() AS database_name');
    expect(result.rows[0]?.database_name).toBe(connection.confirmedDatabase);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('checks connectivity and requires PostgreSQL 16+ with PostGIS', async () => {
    expect(await database!.checkAvailability()).toBe(true);
    const result = await pool!.query<{ server_version_num: string; postgis_version: string }>(
      `SELECT current_setting('server_version_num') AS server_version_num,
              PostGIS_Full_Version() AS postgis_version`,
    );
    expect(Number(result.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(160000);
    expect(result.rows[0]?.postgis_version).toMatch(/POSTGIS/i);
  });

  it('checks required schema objects, views, enums, triggers, indexes, and GPS partitioning', async () => {
    const relations = [
      'vehiculos', 'asignaciones_vehiculo', 'movimientos_vehiculo', 'lecturas_odometro',
      'prestamos_administrativos', 'jornadas', 'cargas_combustible', 'ordenes_mantenimiento',
      'notificaciones', 'sesiones_seguimiento', 'posiciones_gps', 'posiciones_gps_default',
      'ultima_posicion_gps', 'vw_vehiculos_administrativos_disponibles', 'vw_estado_mantenimiento',
      'vw_mapa_vehiculos_tiempo_real', 'vw_estado_dispositivos',
    ];
    const relationResult = await pool!.query<{ object_name: string; relation_name: string | null }>(
      `SELECT object_name, to_regclass('gacor.' || object_name)::text AS relation_name
       FROM unnest($1::text[]) AS object_name`,
      [relations],
    );
    expect(relationResult.rows.filter((row) => row.relation_name === null).map((row) => row.object_name)).toEqual([]);

    // LIMIT 0 checks view permissions and definitions without reading application rows.
    for (const view of [
      'vw_vehiculos_administrativos_disponibles', 'vw_estado_mantenimiento',
      'vw_mapa_vehiculos_tiempo_real', 'vw_estado_dispositivos', 'vw_retencion_gps',
    ]) {
      await pool!.query(`SELECT * FROM gacor.${view} LIMIT 0`);
    }

    const enumResult = await pool!.query<{ type_name: string; present: boolean }>(
      `SELECT wanted.type_name, EXISTS (
         SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
         WHERE n.nspname='gacor' AND t.typname=wanted.type_name AND t.typtype='e'
       ) AS present
       FROM unnest($1::text[]) AS wanted(type_name)`,
      [['estado_prestamo_enum', 'estado_jornada_enum', 'estado_movimiento_enum', 'estado_seguimiento_enum', 'estado_dispositivo_enum']],
    );
    expect(enumResult.rows.filter((row) => !row.present).map((row) => row.type_name)).toEqual([]);

    const indexResult = await pool!.query<{ object_name: string; present: boolean }>(
      `SELECT wanted.object_name, EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='gacor' AND c.relname=wanted.object_name
       ) AS present
       FROM unnest($1::text[]) AS wanted(object_name)`,
      [[
        'uq_prestamo_activo_vehiculo', 'uq_movimiento_abierto_vehiculo',
        'idx_gps_ubicacion', 'idx_gps_fecha_brin',
      ]],
    );
    expect(indexResult.rows.filter((row) => !row.present).map((row) => row.object_name)).toEqual([]);

    const triggerResult = await pool!.query<{ trigger_name: string; present: boolean }>(
      `SELECT wanted.trigger_name, EXISTS (
         SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='gacor' AND t.tgname=wanted.trigger_name AND NOT t.tgisinternal
       ) AS present
       FROM unnest($1::text[]) AS wanted(trigger_name)`,
      [['trg_validar_posicion_gps', 'trg_actualizar_ultima_posicion_gps', 'trg_prestamos_administrativos_audit']],
    );
    expect(triggerResult.rows.filter((row) => !row.present).map((row) => row.trigger_name)).toEqual([]);

    const partitionResult = await pool!.query<{ is_partitioned: boolean; default_partition_exists: boolean }>(
      `SELECT parent.relkind='p' AS is_partitioned,
              EXISTS (
                SELECT 1 FROM pg_inherits i JOIN pg_class child ON child.oid=i.inhrelid
                JOIN pg_namespace n ON n.oid=child.relnamespace
                WHERE i.inhparent=parent.oid AND n.nspname='gacor' AND child.relname='posiciones_gps_default'
              ) AS default_partition_exists
       FROM pg_class parent JOIN pg_namespace n ON n.oid=parent.relnamespace
       WHERE n.nspname='gacor' AND parent.relname='posiciones_gps'`,
    );
    expect(partitionResult.rows[0]).toEqual({ is_partitioned: true, default_partition_exists: true });
  });

  it('executes representative vehicle-view and PostGIS reads with the application connection', async () => {
    const vehicles = await new VehicleRepository(database!).findAdministrativeAvailable({ limit: 1, offset: 0 });
    expect(Array.isArray(vehicles.items)).toBe(true);
    expect(typeof vehicles.hasMore).toBe('boolean');
    for (const vehicle of vehicles.items) {
      expect(vehicle.id).toMatch(/^\d+$/);
      if (vehicle.latestOdometer !== null) expect(vehicle.latestOdometer).toMatch(/^-?\d+(\.\d+)?$/);
    }

    const spatial = await pool!.query<{ srid: number; longitude: number; latitude: number }>(
      `SELECT ST_SRID(point::geometry) AS srid,
              ST_X(point::geometry) AS longitude,
              ST_Y(point::geometry) AS latitude
       FROM (SELECT ST_SetSRID(ST_MakePoint(-90, 14), 4326)::geography AS point) AS sample`,
    );
    expect(spatial.rows[0]).toEqual({ srid: 4326, longitude: -90, latitude: 14 });
  });

  it('checks audit context is transaction-local and cleared after rollback on a reused connection', async () => {
    const context = { userId: '1', ip: '192.0.2.10' };
    const current = await database!.transaction(
      (tx) => tx.query<{ user_id: string; ip: string }>(
        `SELECT current_setting('app.user_id', true) AS user_id,
                current_setting('app.ip', true) AS ip`,
      ),
      context,
    );
    expect(current.rows[0]).toEqual({ user_id: '1', ip: '192.0.2.10' });

    await expect(database!.transaction(async () => {
      throw new Error('intentional rollback probe');
    }, context)).rejects.toThrow('intentional rollback probe');

    const afterRollback = await database!.transaction((tx) => tx.query<{ user_id: string; ip: string }>(
      `SELECT current_setting('app.user_id', true) AS user_id,
              current_setting('app.ip', true) AS ip`,
    ));
    expect(afterRollback.rows[0]?.user_id ?? '').toBe('');
    expect(afterRollback.rows[0]?.ip ?? '').toBe('');
  });

  it.skipIf(!hasAuthorizationFixture)('isolates notification detail by recipient using real records in the integration database', async () => {
    const userA = positiveBigint(fixtureIds.userA!);
    const userB = positiveBigint(fixtureIds.userB!);
    const notificationB = positiveBigint(fixtureIds.notificationB!);
    expect(userA).not.toBe(userB);

    const repository = new NotificationsRepository(database!);
    await expect(repository.findByIdForRecipient(notificationB, userA)).resolves.toBeNull();
    const recipientResult = await repository.findByIdForRecipient(notificationB, userB);
    expect(recipientResult).not.toBeNull();
    expect(Object.keys(recipientResult ?? {}).sort()).toEqual([
      'alert', 'channel', 'createdAt', 'deliveredAt', 'id', 'readAt', 'sentAt', 'state',
    ]);
  });
});

function integrationConnection(): { url: string; confirmedDatabase: string; sslMode: 'disable' | 'verify-full' } {
  if (process.env.NODE_ENV === 'production') throw new Error('PostgreSQL integration suite refuses NODE_ENV=production');
  const rawUrl = process.env.PG_INTEGRATION_DATABASE_URL;
  const confirmedDatabase = process.env.PG_INTEGRATION_CONFIRM_DATABASE;
  const sslMode = process.env.PG_INTEGRATION_SSL;
  if (!rawUrl || !confirmedDatabase || (sslMode !== 'disable' && sslMode !== 'verify-full')) {
    throw new Error('Integration requires PG_INTEGRATION_DATABASE_URL, PG_INTEGRATION_CONFIRM_DATABASE, and PG_INTEGRATION_SSL');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('PG_INTEGRATION_DATABASE_URL must be a valid PostgreSQL URL');
  }
  if ((parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') || !parsed.hostname) {
    throw new Error('PG_INTEGRATION_DATABASE_URL must identify a PostgreSQL host');
  }
  const forbiddenSslParameters = ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey'];
  if (forbiddenSslParameters.some((parameter) => parsed.searchParams.has(parameter))) {
    throw new Error('Set integration TLS only with PG_INTEGRATION_SSL, not URL SSL parameters');
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (databaseName !== confirmedDatabase || !/(?:_test|_integration)$/i.test(databaseName)) {
    throw new Error('Integration database name must match confirmation and end in _test or _integration');
  }

  const configuredApplicationDatabase = process.env.PGDATABASE?.trim();
  if (configuredApplicationDatabase === databaseName) {
    throw new Error('Integration URL must not target the configured application database');
  }

  const configuredApplicationUrl = process.env.DATABASE_URL;
  if (configuredApplicationUrl) {
    try {
      const appUrl = new URL(configuredApplicationUrl);
      const sameDatabase = decodeURIComponent(appUrl.pathname.slice(1)) === databaseName;
      if (sameDatabase) throw new Error('Integration URL must not target the configured application database');
    } catch (error) {
      if (error instanceof Error && error.message === 'Integration URL must not target the configured application database') throw error;
      throw new Error('Cannot verify integration database separation from DATABASE_URL');
    }
  }
  return { url: rawUrl, confirmedDatabase, sslMode };
}

function positiveBigint(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error('Integration fixture IDs must be positive BIGINT values');
  const integer = BigInt(value);
  if (integer < 1n || integer > 9_223_372_036_854_775_807n) {
    throw new Error('Integration fixture IDs must be positive BIGINT values');
  }
  return integer.toString();
}
