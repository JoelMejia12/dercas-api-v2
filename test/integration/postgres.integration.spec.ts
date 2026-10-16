import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomBytes, createHash } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AppExceptionFilter } from '../../src/common/http/app-exception.filter';
import { requestIdMiddleware } from '../../src/common/http/request-id.middleware';
import { noStoreMiddleware } from '../../src/common/http/no-store.middleware';
import { RequestLoggingInterceptor } from '../../src/common/logging/request-logging.interceptor';
import { SecureLogger } from '../../src/common/logging/secure-logger.service';
import { DatabaseService } from '../../src/database/database.service';
import { buildPoolConfig } from '../../src/database/database.module';
import { NotificationsRepository } from '../../src/notifications/notifications.repository';
import { VehicleRepository } from '../../src/vehicles/vehicle.repository';
import { setupOpenApi } from '../../src/openapi/openapi';

const explicitlyEnabled = process.env.RUN_PG_INTEGRATION === '1';
const fixtureIds = {
  userA: process.env.PG_INTEGRATION_USER_A_ID,
  userB: process.env.PG_INTEGRATION_USER_B_ID,
  notificationB: process.env.PG_INTEGRATION_NOTIFICATION_B_ID,
};
const hasAuthorizationFixture = Object.values(fixtureIds).every((value) => value !== undefined);

let pool: Pool | undefined;
let database: DatabaseService | undefined;
const authFixture = {
  email: process.env.PG_INTEGRATION_AUTH_EMAIL,
  password: process.env.PG_INTEGRATION_AUTH_PASSWORD,
  deviceId: process.env.PG_INTEGRATION_AUTH_DEVICE_ID,
  deviceToken: process.env.PG_INTEGRATION_AUTH_DEVICE_TOKEN,
};
const hasAuthFixture = Object.values(authFixture).every((value) => value !== undefined && value !== '');
const authWritesConfirmed = process.env.PG_INTEGRATION_AUTH_WRITES_CONFIRMED === '1';

describe.skipIf(!explicitlyEnabled)('PostgreSQL integration (explicit opt-in)', () => {
  beforeAll(async () => {
    const connection = integrationConnection();
    const poolConfig = buildPoolConfig({ connectionString: connection.url, sslMode: connection.sslMode });
    if (!poolConfig) throw new Error('Integration pool configuration is unavailable');
    pool = new Pool({ ...poolConfig, max: 1, application_name: 'dercas-integration-tests' });
    database = new DatabaseService(pool, { error: () => undefined } as unknown as SecureLogger);

    const result = await pool.query<{ database_name: string; search_path: string }>(
      `SELECT current_database() AS database_name, current_setting('search_path') AS search_path`,
    );
    expect(result.rows[0]?.database_name).toBe(connection.confirmedDatabase);
    expect(result.rows[0]?.search_path.replace(/\s+/g, '')).toBe('gacor,public');
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
    expect(current.rows[0]?.user_id).toBe('1');
    expect(current.rows[0]?.ip).toBe('192.0.2.10/32');

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

describe.skipIf(!explicitlyEnabled || !hasAuthFixture || !authWritesConfirmed)('HTTP authentication integration (persistent fixture)', () => {
  let app: INestApplication | undefined;
  let baseUrl: string;
  let database: DatabaseService;
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeAll(async () => {
    const connection = integrationConnection();
    if (authFixture.deviceId !== '1') {
      throw new Error('HTTP authentication integration requires the confirmed device fixture ID 1');
    }
    originalEnvironment = { ...process.env };
    process.env.DATABASE_URL = connection.url;
    for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) delete process.env[key];
    process.env.PGSSL = connection.sslMode;
    process.env.AUTH_TOKEN_SECRET = randomBytes(48).toString('base64url');
    process.env.NODE_ENV = 'test';

    app = await NestFactory.create(AppModule, { logger: false });
    const express = app.getHttpAdapter().getInstance();
    express.set('trust proxy', false);
    app.use(requestIdMiddleware);
    app.use(noStoreMiddleware);
    app.setGlobalPrefix('api/v1');
    setupOpenApi(app);
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }));
    const logger = app.get(SecureLogger);
    app.useGlobalFilters(new AppExceptionFilter(logger));
    app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Unable to start local HTTP integration server');
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    database = app.get(DatabaseService);

    // Verify the pool created by AppModule itself before issuing any HTTP request.
    try {
      const runtimeTarget = await database.query<{ database_name: string; search_path: string }>(
        `SELECT current_database() AS database_name, current_setting('search_path') AS search_path`,
      );
      if (runtimeTarget.rows[0]?.database_name !== connection.confirmedDatabase
        || runtimeTarget.rows[0]?.search_path.replace(/\s+/g, '') !== 'gacor,public') {
        throw new Error('Nest application database target or search_path does not match the confirmed integration target');
      }

      const deviceTokenHash = createHash('sha256').update(authFixture.deviceToken!, 'utf8').digest('hex');
      const fixture = await database.query<{ identity_ready: boolean; no_open_session: boolean }>(
        `SELECT
           EXISTS (
             SELECT 1 FROM gacor.usuarios u
             JOIN gacor.dispositivos d ON d.usuario_asociado_id = u.id
             WHERE u.id = 1 AND u.correo = $1 AND u.activo = TRUE
               AND d.id = 1 AND d.activo = TRUE AND d.device_token_hash = $2
           ) AS identity_ready,
           NOT EXISTS (
             SELECT 1 FROM gacor.sesiones_dispositivo
             WHERE dispositivo_id = 1 AND estado = 'ABIERTA'::gacor.estado_sesion_dispositivo_enum
           ) AS no_open_session`,
        [authFixture.email, deviceTokenHash],
      );
      if (fixture.rows[0]?.identity_ready !== true || fixture.rows[0]?.no_open_session !== true) {
        throw new Error('Authentication fixture is not eligible; refusing to mutate database records');
      }
    } catch (error) {
      await app.close();
      app = undefined;
      restoreEnvironment(originalEnvironment);
      if (error instanceof Error && error.message === 'Authentication fixture is not eligible; refusing to mutate database records') {
        throw error;
      }
      if (error instanceof Error && error.message === 'Nest application database target or search_path does not match the confirmed integration target') {
        throw error;
      }
      throw new Error('Unable to verify the Nest database target and authentication fixture; refusing to issue HTTP requests');
    }
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (originalEnvironment) restoreEnvironment(originalEnvironment);
  });

  it('serves OpenAPI with live paths, auth scheme, and required permission metadata', async () => {
    const uiResponse = await fetch(`${baseUrl}/docs`);
    expect(uiResponse.status).toBe(200);
    expect(uiResponse.headers.get('content-type')).toContain('text/html');
    const response = await fetch(`${baseUrl}/docs/openapi.json`);
    expect(response.status).toBe(200);
    const document = await response.json() as {
      openapi: string;
      info: { title: string; version: string };
      paths: Record<string, Record<string, {
        security?: unknown; 'x-required-permissions'?: unknown; requestBody?: unknown;
        parameters?: Array<{ name: string; required?: boolean; schema?: { type?: string } }>;
        responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
      }>>;
      components: {
        securitySchemes: Record<string, { type: string; scheme: string; bearerFormat: string }>;
        schemas: Record<string, { properties?: Record<string, { writeOnly?: boolean }> }>;
      };
    };
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info).toMatchObject({ title: 'API GACOR/DERCAS', version: '0.1.0' });
    expect(document.paths['/api/v1/auth/sessions']?.post?.requestBody).toBeDefined();
    expect(document.paths['/api/v1/auth/sessions']?.post?.responses?.['201']?.content?.['application/json']?.schema?.$ref)
      .toBe('#/components/schemas/TokenPairDto');
    expect(document.components.schemas['LoginDto']?.properties?.['password']?.writeOnly).toBe(true);
    expect(document.components.schemas['LoginDto']?.properties?.['deviceToken']?.writeOnly).toBe(true);
    const vehicleParameters = document.paths['/api/v1/vehicles/administrative/available']?.get?.parameters ?? [];
    for (const name of ['limit', 'offset']) {
      const parameter = vehicleParameters.find((item) => item.name === name);
      expect(parameter).toMatchObject({ required: false, schema: { type: 'integer' } });
    }
    expect(document.paths['/api/v1/users/me']?.get?.security).toEqual([{ accessToken: [] }]);
    expect(document.paths['/api/v1/cabinet']?.get?.['x-required-permissions']).toEqual(['GABINETE_VER']);
    expect(document.components.securitySchemes['accessToken']).toEqual({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(document.paths['/api/v1/health/live']?.get?.responses?.['200']?.content?.['application/json']?.schema)
      .toMatchObject({ properties: { status: { enum: ['alive'] } } });
    expect(document.paths['/api/v1/health/ready']?.get?.responses).toHaveProperty('200');
    expect(document.paths['/api/v1/health/ready']?.get?.responses).toHaveProperty('503');
    const operationCount = Object.values(document.paths).reduce((count, path) => count
      + Object.keys(path).filter((method) => ['get', 'post', 'put', 'patch', 'delete'].includes(method)).length, 0);
    expect(operationCount).toBe(72);
  });

  it('serializes concurrent login, rotates refresh, and verifies revoke/logout without logging credentials', async () => {
    let accessToken: string | undefined;
    let sessionId: string | undefined;
    let sessionRevoked = false;
    let loginMayHaveCommitted = false;
    const returnedTokens: string[] = [];
    const additionalSessions: Array<{ accessToken: string; sessionId: string }> = [];
    const invalidPassword = randomBytes(32).toString('base64url');
    const logEntries: unknown[] = [];
    const logger = app!.get(SecureLogger);
    const logSpy = vi.spyOn(logger, 'log').mockImplementation((message, ...fields) => { logEntries.push([message, ...fields]); });
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation((message, ...fields) => { logEntries.push([message, ...fields]); });
    try {
      const liveResponse = await fetch(`${baseUrl}/health/live`);
      expect(liveResponse.status).toBe(200);
      expect(await liveResponse.json()).toEqual({ status: 'alive' });
      const readyResponse = await fetch(`${baseUrl}/health/ready`);
      expect(readyResponse.status).toBe(200);
      expect(await readyResponse.json()).toEqual({ status: 'ready', checks: { process: 'up', database: 'up' } });

      const invalidLogin = (email: string) => fetch(`${baseUrl}/auth/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: invalidPassword, deviceId: authFixture.deviceId, deviceToken: authFixture.deviceToken }),
      });
      const [knownUserFailure, unknownUserFailure] = await Promise.all([
        invalidLogin(authFixture.email!), invalidLogin(`missing-${randomBytes(8).toString('hex')}@example.invalid`),
      ]);
      expect(knownUserFailure.status).toBe(401);
      expect(unknownUserFailure.status).toBe(401);
      const [knownFailureBody, unknownFailureBody] = await Promise.all([
        knownUserFailure.json() as Promise<Record<string, unknown>>,
        unknownUserFailure.json() as Promise<Record<string, unknown>>,
      ]);
      expect({ title: knownFailureBody['title'], code: knownFailureBody['code'], detail: knownFailureBody['detail'] })
        .toEqual({ title: unknownFailureBody['title'], code: unknownFailureBody['code'], detail: unknownFailureBody['detail'] });

      loginMayHaveCommitted = true;
      const concurrentResponses = await Promise.all(Array.from({ length: 2 }, () => fetch(`${baseUrl}/auth/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: authFixture.email,
          password: authFixture.password,
          deviceId: authFixture.deviceId,
          deviceToken: authFixture.deviceToken,
        }),
      })));
      const successfulResponses = concurrentResponses.filter((response) => response.status === 201);
      const concurrentLogins = await Promise.all(successfulResponses.map(async (response) => (
        response.json() as Promise<{ accessToken: string; refreshToken: string; sessionId: string }>
      )));
      const login = concurrentLogins[0];
      if (login) {
        accessToken = login.accessToken;
        sessionId = login.sessionId;
        returnedTokens.push(login.accessToken, login.refreshToken);
        for (const extra of concurrentLogins.slice(1)) {
          additionalSessions.push({ accessToken: extra.accessToken, sessionId: extra.sessionId });
          returnedTokens.push(extra.accessToken, extra.refreshToken);
        }
      }
      const failureDiagnostics = logEntries.flatMap((entry) => {
        if (!Array.isArray(entry)) return [];
        const fields = entry[2];
        if (typeof fields !== 'object' || fields === null) return [];
        const safe = fields as Record<string, unknown>;
        return [{ method: safe['method'], path: safe['path'], status: safe['status'], errorType: safe['errorType'], errorCode: safe['errorCode'] }];
      });
      const httpDiagnostics = await Promise.all(concurrentResponses.filter((response) => response.status >= 400).map(async (response) => {
        const body = await response.clone().json() as Record<string, unknown>;
        return { status: response.status, title: body['title'], code: body['code'], detail: body['detail'] };
      }));
      expect(concurrentResponses.map((response) => response.status).sort(), JSON.stringify({ failureDiagnostics, httpDiagnostics })).toEqual([201, 409]);
      if (!login) throw new Error('Concurrent login did not produce a successful session');
      const loginResponse = successfulResponses[0]!;
      expect(loginResponse.headers.get('cache-control')).toBe('no-store');
      expect(typeof login.accessToken).toBe('string');
      expect(typeof login.refreshToken).toBe('string');
      expect(typeof login.sessionId).toBe('string');

      const profileResponse = await fetch(`${baseUrl}/users/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.headers.get('cache-control')).toBe('no-store');
      const profile = await profileResponse.json() as Record<string, unknown>;
      expect(profile.email).toBe(authFixture.email);
      expect(profile).not.toHaveProperty('password_hash');
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('device_token_hash');
      expect(profile).not.toHaveProperty('deviceTokenHash');

      const ownAccessResponse = await fetch(`${baseUrl}/users/me/access`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(ownAccessResponse.status).toBe(200);
      expect(await ownAccessResponse.json()).toEqual({ roles: [], permissions: [] });

      const protectedCabinetResponse = await fetch(`${baseUrl}/cabinet`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(protectedCabinetResponse.status).toBe(403);

      const foreignNotificationResponse = await fetch(`${baseUrl}/notifications/me/1`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(foreignNotificationResponse.status).toBe(404);

      const foreignAlertResponse = await fetch(`${baseUrl}/alerts/me/1`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(foreignAlertResponse.status).toBe(404);

      const refreshResponse = await fetch(`${baseUrl}/auth/sessions/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, refreshToken: login.refreshToken }),
      });
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.headers.get('cache-control')).toBe('no-store');
      const rotated = await refreshResponse.json() as { accessToken: string; refreshToken: string; sessionId: string };
      expect(rotated.sessionId === sessionId).toBe(true);
      expect(rotated.refreshToken === login.refreshToken).toBe(false);
      expect(rotated.accessToken === login.accessToken).toBe(false);
      accessToken = rotated.accessToken;
      returnedTokens.push(rotated.accessToken, rotated.refreshToken);

      const replayResponse = await fetch(`${baseUrl}/auth/sessions/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, refreshToken: login.refreshToken }),
      });
      expect(replayResponse.status).toBe(401);

      const revokeResponse = await fetch(`${baseUrl}/auth/sessions/revoke`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(revokeResponse.status).toBe(204);
      accessToken = undefined;
      sessionRevoked = true;

      const revokedRefreshResponse = await fetch(`${baseUrl}/auth/sessions/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, refreshToken: rotated.refreshToken }),
      });
      expect(revokedRefreshResponse.status).toBe(401);

      const revokedAccessResponse = await fetch(`${baseUrl}/auth/sessions/revoke`, {
        method: 'POST',
        headers: { authorization: `Bearer ${rotated.accessToken}` },
      });
      expect(revokedAccessResponse.status).toBe(401);
      const persisted = await database.query<{
        state: string; refresh_hash_cleared: boolean; logged_out: boolean; last_access_recorded: boolean;
      }>(
        `SELECT s.estado::text AS state, s.refresh_token_hash IS NULL AS refresh_hash_cleared,
                s.logout_at IS NOT NULL AS logged_out, u.ultimo_acceso_at IS NOT NULL AS last_access_recorded
         FROM gacor.sesiones_dispositivo s JOIN gacor.usuarios u ON u.id=s.usuario_id
         WHERE s.id=$1::bigint AND u.correo=$2`,
        [sessionId, authFixture.email],
      );
      expect(persisted.rows[0]).toEqual({
        state: 'REVOCADA', refresh_hash_cleared: true, logged_out: true, last_access_recorded: true,
      });

      const logoutLoginResponse = await fetch(`${baseUrl}/auth/sessions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: authFixture.email,
          password: authFixture.password,
          deviceId: authFixture.deviceId,
          deviceToken: authFixture.deviceToken,
        }),
      });
      expect(logoutLoginResponse.status).toBe(201);
      const logoutLogin = await logoutLoginResponse.json() as { accessToken: string; refreshToken: string; sessionId: string };
      accessToken = logoutLogin.accessToken;
      sessionId = logoutLogin.sessionId;
      sessionRevoked = false;
      returnedTokens.push(logoutLogin.accessToken, logoutLogin.refreshToken);

      const logoutResponse = await fetch(`${baseUrl}/auth/sessions/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(logoutResponse.status).toBe(204);
      sessionRevoked = true;

      const closedRefreshResponse = await fetch(`${baseUrl}/auth/sessions/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, refreshToken: logoutLogin.refreshToken }),
      });
      expect(closedRefreshResponse.status).toBe(401);
      const closedAccessResponse = await fetch(`${baseUrl}/users/me`, {
        headers: { authorization: `Bearer ${logoutLogin.accessToken}` },
      });
      expect(closedAccessResponse.status).toBe(401);

      const closedPersisted = await database.query<{
        state: string; refreshHashCleared: boolean; loggedOut: boolean; deviceUnauthenticated: boolean;
      }>(
        `SELECT s.estado::text AS state, s.refresh_token_hash IS NULL AS "refreshHashCleared",
                s.logout_at IS NOT NULL AS "loggedOut", d.autenticado = FALSE AS "deviceUnauthenticated"
         FROM gacor.sesiones_dispositivo s JOIN gacor.dispositivos d ON d.id=s.dispositivo_id
         WHERE s.id=$1::bigint AND s.usuario_id=1`,
        [sessionId],
      );
      expect(closedPersisted.rows[0]).toEqual({
        state: 'CERRADA', refreshHashCleared: true, loggedOut: true, deviceUnauthenticated: true,
      });

      const serializedLogs = JSON.stringify(logEntries);
      expect([authFixture.email!, authFixture.password!, authFixture.deviceToken!, invalidPassword, ...returnedTokens]
        .some((secret) => serializedLogs.includes(secret))).toBe(false);
    } finally {
      for (const extra of additionalSessions) {
        try {
          const cleanupResponse = await fetch(`${baseUrl}/auth/sessions/revoke`, {
            method: 'POST',
            headers: { authorization: `Bearer ${extra.accessToken}` },
          });
          if (cleanupResponse.status !== 204) {
            process.stderr.write(`${JSON.stringify({
              level: 'error', event: 'integration_auth_session_cleanup_failed',
              reason: 'unexpected_http_status', status: cleanupResponse.status, manual_inspection_required: true,
            })}\n`);
          }
        } catch {
          process.stderr.write(`${JSON.stringify({
            level: 'error', event: 'integration_auth_session_cleanup_failed',
            reason: 'request_failed', manual_inspection_required: true,
          })}\n`);
        }
      }
      if (sessionId && accessToken && !sessionRevoked) {
        try {
          // This token is issued for the sessionId captured by this test. A failed
          // or ambiguous cleanup is handled manually; never delete fixture rows.
          const cleanupResponse = await fetch(`${baseUrl}/auth/sessions/revoke`, {
            method: 'POST',
            headers: { authorization: `Bearer ${accessToken}` },
          });
          if (cleanupResponse.status !== 204) {
            process.stderr.write(`${JSON.stringify({
              level: 'error',
              event: 'integration_auth_session_cleanup_failed',
              reason: 'unexpected_http_status',
              status: cleanupResponse.status,
              manual_inspection_required: true,
            })}\n`);
          }
        } catch {
          process.stderr.write(`${JSON.stringify({
            level: 'error',
            event: 'integration_auth_session_cleanup_failed',
            reason: 'request_failed',
            manual_inspection_required: true,
          })}\n`);
        }
      } else if (sessionId && !sessionRevoked) {
        process.stderr.write(`${JSON.stringify({
          level: 'error',
          event: 'integration_auth_session_cleanup_failed',
          reason: 'no_usable_access_token',
          manual_inspection_required: true,
        })}\n`);
      } else if (!sessionId && loginMayHaveCommitted) {
        process.stderr.write(`${JSON.stringify({
          level: 'error',
          event: 'integration_auth_session_cleanup_failed',
          reason: 'session_id_unavailable',
          manual_inspection_required: true,
        })}\n`);
      }
      // If no usable access token was obtained, sessionId alone cannot authorize
      // revocation; the operator must inspect the fixture session manually.
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  }, 30_000);
});

function integrationConnection(): { url: string; confirmedDatabase: string; confirmedHost: string; confirmedPort: number; sslMode: 'disable' | 'verify-full' } {
  if (process.env.NODE_ENV === 'production') throw new Error('PostgreSQL integration suite refuses NODE_ENV=production');
  const rawUrl = process.env.PG_INTEGRATION_DATABASE_URL;
  const confirmedDatabase = process.env.PG_INTEGRATION_CONFIRM_DATABASE;
  const confirmedHost = process.env.PG_INTEGRATION_CONFIRM_HOST;
  const confirmedPortText = process.env.PG_INTEGRATION_CONFIRM_PORT;
  const sslMode = process.env.PG_INTEGRATION_SSL;
  if (!rawUrl || !confirmedDatabase || !confirmedHost || !confirmedPortText || (sslMode !== 'disable' && sslMode !== 'verify-full')) {
    throw new Error('Integration requires dedicated URL, confirmed host/port/database, and TLS mode settings');
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
  const confirmedPort = Number(confirmedPortText);
  const actualPort = Number(parsed.port || '5432');
  if (parsed.hostname !== confirmedHost || !Number.isInteger(confirmedPort) || actualPort !== confirmedPort) {
    throw new Error('Integration URL host and port must match their explicit confirmation values');
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
  return { url: rawUrl, confirmedDatabase, confirmedHost, confirmedPort, sslMode };
}

function restoreEnvironment(original: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in original)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function positiveBigint(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error('Integration fixture IDs must be positive BIGINT values');
  const integer = BigInt(value);
  if (integer < 1n || integer > 9_223_372_036_854_775_807n) {
    throw new Error('Integration fixture IDs must be positive BIGINT values');
  }
  return integer.toString();
}
