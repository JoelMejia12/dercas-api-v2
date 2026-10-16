import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DatabaseService } from '../../src/database/database.service';
import { buildPoolConfig } from '../../src/database/database.module';
import { SecureLogger } from '../../src/common/logging/secure-logger.service';
import { AppModule } from '../../src/app.module';
import { AppExceptionFilter } from '../../src/common/http/app-exception.filter';
import { RequestLoggingInterceptor } from '../../src/common/logging/request-logging.interceptor';
import { requestIdMiddleware } from '../../src/common/http/request-id.middleware';
import { noStoreMiddleware } from '../../src/common/http/no-store.middleware';
import { setupOpenApi } from '../../src/openapi/openapi';
import { PasswordHasher } from '../../src/auth/password-hasher.service';
import { OpaqueTokenService } from '../../src/auth/opaque-token.service';
import { JourneyConflictError, JourneysRepository } from '../../src/journeys/journeys.repository';
import { AssignmentRepository } from '../../src/assignments/assignment.repository';
import { MovementsRepository } from '../../src/movements/movements.repository';
import { OdometerRepository } from '../../src/odometer/odometer.repository';
import {
  LoanRequestIdempotencyConflictError,
  LoanRequestRepository,
  LoanRequestUnavailableError,
} from '../../src/loans/loan-request.repository';
import { FuelIdempotencyConflictError, FuelRepository } from '../../src/fuel/fuel.repository';
import { IncidentsRepository, IncidentIdempotencyConflictError } from '../../src/incidents/incidents.repository';
import { ActiveBlockingMaintenanceOrderError, MaintenanceRepository } from '../../src/maintenance/maintenance.repository';
import { GpsPositionRepository } from '../../src/gps/gps-position.repository';
import { AuthRepository } from '../../src/auth/auth.repository';
import { GpsPageQueryDto, GpsPositionHistoryQueryDto } from '../../src/gps/gps-read.dto';
import { GpsReadRepository } from '../../src/gps/gps-read.repository';

const enabled = process.env.RUN_PG_INTEGRATION === '1'
  && process.env.PG_INTEGRATION_DOMAIN_WRITES_CONFIRMED === '1';
let pool: Pool;
let database: DatabaseService;
let runtimeDatabaseUrl: string;

async function captureAuditBoundary(): Promise<string> {
  const result = await pool.query<{ id: string }>('SELECT COALESCE(MAX(id), 0)::text AS id FROM gacor.bitacora');
  return result.rows[0]!.id;
}

async function removeFixtureAuditSince(boundary: string | undefined): Promise<void> {
  if (boundary !== undefined) await pool.query('DELETE FROM gacor.bitacora WHERE id > $1::bigint', [boundary]);
}

describe.skipIf(!enabled)('Domain write integration (isolated PostgreSQL writes)', () => {
  beforeAll(async () => {
    const url = process.env.PG_INTEGRATION_DATABASE_URL;
    const databaseName = process.env.PG_INTEGRATION_CONFIRM_DATABASE;
    const host = process.env.PG_INTEGRATION_CONFIRM_HOST;
    const port = Number(process.env.PG_INTEGRATION_CONFIRM_PORT);
    if (!url || databaseName !== 'dercas_journey_test' || host !== '127.0.0.1' || port !== 32769) {
      throw new Error('Domain write integration requires the dedicated localhost:32769 dercas_journey_test database');
    }
    const parsed = new URL(url);
    if (parsed.hostname !== host || Number(parsed.port || 5432) !== port || parsed.username !== 'postgres'
      || decodeURIComponent(parsed.pathname.slice(1)) !== databaseName) {
      throw new Error('Journey integration URL does not match its confirmed localhost target');
    }
    const config = buildPoolConfig({ connectionString: url, sslMode: 'disable' });
    if (!config) throw new Error('Journey integration pool configuration is unavailable');
    pool = new Pool({ ...config, max: 2, application_name: 'dercas-journey-flow-integration' });
    const target = await pool.query<{ database_name: string }>('SELECT current_database() AS database_name');
    if (target.rows[0]?.database_name !== databaseName) throw new Error('Journey integration connected to an unexpected database');
    const role = await pool.query<{
      superuser: boolean; create_database: boolean; create_role: boolean; inherit: boolean; memberships: string;
    }>(
      `SELECT r.rolsuper AS superuser, r.rolcreatedb AS create_database, r.rolcreaterole AS create_role,
              r.rolinherit AS inherit,
              (SELECT count(*)::text FROM pg_auth_members WHERE member=r.oid) AS memberships
       FROM pg_roles r WHERE r.rolname='dercas_api_runtime'`,
    );
    if (role.rowCount !== 1 || role.rows[0]!.superuser || role.rows[0]!.create_database
      || role.rows[0]!.create_role || role.rows[0]!.inherit || role.rows[0]!.memberships !== '0') {
      throw new Error('Create the isolated dercas_api_runtime role with test/fixtures/dercas_api_runtime_role.sql before domain-write integration');
    }
    const forbiddenPrivileges = await pool.query<{ has_forbidden_privileges: boolean }>(
      `SELECT has_schema_privilege('dercas_api_runtime','gacor','CREATE')
           OR has_schema_privilege('dercas_api_runtime','public','CREATE')
           OR has_database_privilege('dercas_api_runtime',current_database(),'CREATE')
           OR has_table_privilege('dercas_api_runtime','gacor.usuarios','DELETE')
           OR has_table_privilege('dercas_api_runtime','gacor.jornadas','DELETE')
           OR has_table_privilege('dercas_api_runtime','gacor.gabinetes','SELECT')
           OR has_column_privilege('dercas_api_runtime','gacor.usuarios','password_hash','UPDATE')
           OR has_column_privilege('dercas_api_runtime','gacor.dispositivos','device_token_hash','UPDATE')
           OR has_column_privilege('dercas_api_runtime','gacor.sesiones_dispositivo','usuario_id','UPDATE')
           OR has_column_privilege('dercas_api_runtime','gacor.movimientos_vehiculo','vehiculo_id','UPDATE')
           OR has_column_privilege('dercas_api_runtime','gacor.jornadas','asignacion_id','UPDATE')
           OR has_table_privilege('dercas_api_runtime','gacor.usuarios','UPDATE')
           OR has_table_privilege('dercas_api_runtime','gacor.dispositivos','UPDATE')
           OR has_table_privilege('dercas_api_runtime','gacor.sesiones_dispositivo','UPDATE')
           OR has_table_privilege('dercas_api_runtime','gacor.movimientos_vehiculo','UPDATE')
           OR has_table_privilege('dercas_api_runtime','gacor.jornadas','UPDATE')
           OR NOT has_column_privilege('dercas_api_runtime','gacor.usuarios','ultimo_acceso_at','UPDATE')
           OR NOT has_column_privilege('dercas_api_runtime','gacor.dispositivos','autenticado','UPDATE')
           OR NOT has_column_privilege('dercas_api_runtime','gacor.sesiones_dispositivo','refresh_token_hash','UPDATE')
           OR NOT has_column_privilege('dercas_api_runtime','gacor.movimientos_vehiculo','lectura_fin_id','UPDATE')
           OR NOT has_column_privilege('dercas_api_runtime','gacor.jornadas','observaciones_fin','UPDATE')
           OR NOT has_column_privilege('dercas_api_runtime','gacor.asignaciones_vehiculo','id','UPDATE')
           OR NOT has_column_privilege('dercas_api_runtime','gacor.vehiculos','id','UPDATE') AS has_forbidden_privileges`,
    );
    if (forbiddenPrivileges.rows[0]?.has_forbidden_privileges) {
      throw new Error('dercas_api_runtime has broad/forbidden privileges or lacks a required column-scoped grant');
    }
    const runtimeUrl = new URL(url);
    runtimeUrl.username = 'dercas_api_runtime';
    runtimeUrl.password = '';
    runtimeDatabaseUrl = runtimeUrl.toString();
    const runtimeConfig = buildPoolConfig({ connectionString: runtimeDatabaseUrl, sslMode: 'disable' });
    if (!runtimeConfig) throw new Error('Runtime role integration pool configuration is unavailable');
    const runtimePool = new Pool({ ...runtimeConfig, max: 1, application_name: 'dercas-runtime-acl-preflight' });
    try {
      const identity = await runtimePool.query<{ role_name: string; database_name: string }>(
        'SELECT current_user AS role_name, current_database() AS database_name',
      );
      if (identity.rows[0]?.role_name !== 'dercas_api_runtime' || identity.rows[0]?.database_name !== databaseName) {
        throw new Error('Runtime ACL preflight connected to an unexpected PostgreSQL identity or database');
      }
    } finally {
      await runtimePool.end();
    }
    database = new DatabaseService(pool, { error: () => undefined } as unknown as SecureLogger);
  });

  afterAll(async () => pool?.end());

  it('starts, safely replays, rejects decreasing odometer, and finishes a brigade journey', async () => {
    const suffix = randomUUID();
    const created: {
      userId?: string; foreignUserId?: string; brigadeId?: string; vehicleId?: string; assignmentId?: string; incidentId?: string;
      maintenanceId?: string; deviceId?: string; trackingSessionId?: string;
      authSessionId?: string;
    } = {};
    let auditBoundary: string | undefined;
    try {
      auditBoundary = await captureAuditBoundary();
      const user = await pool.query<{ id: string }>(
        `INSERT INTO gacor.usuarios (nombres, apellidos, correo, password_hash)
         VALUES ('Integration', 'Journey', $1, 'test-only-hash') RETURNING id::text AS id`,
        [`journey-${suffix}@example.invalid`],
      );
      created.userId = user.rows[0]!.id;
      const foreignUser = await pool.query<{ id: string }>(
        `INSERT INTO gacor.usuarios (nombres, apellidos, correo, password_hash)
         VALUES ('Integration', 'Foreign Journey User', $1, 'test-only-hash') RETURNING id::text AS id`,
        [`journey-foreign-${suffix}@example.invalid`],
      );
      created.foreignUserId = foreignUser.rows[0]!.id;
      const brigade = await pool.query<{ id: string }>(
        `INSERT INTO gacor.brigadas (codigo, nombre) VALUES ($1, 'Integration brigade') RETURNING id::text AS id`,
        [`it-${suffix}`],
      );
      created.brigadeId = brigade.rows[0]!.id;
      const vehicle = await pool.query<{ id: string }>(
        `INSERT INTO gacor.vehiculos (brigada_id, placa, marca, tipo)
         VALUES ($1::bigint, $2, 'Integration', 'BRIGADA'::gacor.tipo_vehiculo_enum) RETURNING id::text AS id`,
        [created.brigadeId, `IT-${suffix.slice(0, 12)}`],
      );
      created.vehicleId = vehicle.rows[0]!.id;
      const assignment = await pool.query<{ id: string }>(
        `INSERT INTO gacor.asignaciones_vehiculo (vehiculo_id, piloto_id, asignado_por_id)
         VALUES ($1::bigint, $2::bigint, $2::bigint) RETURNING id::text AS id`,
        [created.vehicleId, created.userId],
      );
      created.assignmentId = assignment.rows[0]!.id;

      const repository = new JourneysRepository(database);
      const start = {
        userId: created.userId!, operationId: randomUUID(), kilometers: '12345.0',
        deviceAt: '2026-10-15T08:00:00.000Z', observations: 'Inicio de prueba', auditIp: '127.0.0.1',
      };
      const [journey, retriedJourney] = await Promise.all([repository.start(start), repository.start(start)]);
      expect(journey).toMatchObject({ state: 'ABIERTA', assignmentId: created.assignmentId, initialOdometer: { kilometers: '12345.0' } });
      expect(retriedJourney).toMatchObject({ id: journey.id });
      expect(await repository.findByIdForUser(journey.id, created.userId!)).toMatchObject({ id: journey.id });
      expect(await repository.findByIdForUser(journey.id, created.foreignUserId!)).toBeNull();
      expect(await repository.findHistoryForUser(created.foreignUserId!, { limit: 10, offset: 0 }))
        .toMatchObject({ items: [], hasMore: false });
      expect(await repository.findCurrentForUser(created.foreignUserId!)).toBeNull();

      const assignments = new AssignmentRepository(database);
      expect(await assignments.findByIdForPilot(created.assignmentId!, created.userId!)).toMatchObject({ id: created.assignmentId });
      expect(await assignments.findByIdForPilot(created.assignmentId!, created.foreignUserId!)).toBeNull();
      expect(await assignments.findHistoryForPilot(created.foreignUserId!, 10, 0))
        .toMatchObject({ items: [], hasMore: false });

      const movements = new MovementsRepository(database);
      expect(await movements.findById(created.userId!, journey.movement.id, 'assigned')).toMatchObject({ id: journey.movement.id });
      expect(await movements.findById(created.foreignUserId!, journey.movement.id, 'assigned')).toBeNull();
      expect(await movements.findHistory(created.foreignUserId!, 'assigned', { limit: 10, offset: 0 }))
        .toMatchObject({ items: [], hasMore: false });

      const odometers = new OdometerRepository(database);
      expect(journey.initialOdometer).not.toBeNull();
      expect(await odometers.findByIdForUser(journey.initialOdometer!.id, created.userId!))
        .toMatchObject({ id: journey.initialOdometer!.id });
      expect(await odometers.findByIdForUser(journey.initialOdometer!.id, created.foreignUserId!)).toBeNull();
      expect(await odometers.findHistoryForUser(created.foreignUserId!, { limit: 10, offset: 0 }))
        .toMatchObject({ items: [], hasMore: false });

      const competingStart = { ...start, operationId: randomUUID(), kilometers: '12346.0' };
      await expect(repository.start(competingStart)).rejects.toBeInstanceOf(JourneyConflictError);
      const competingWrites = await pool.query<{ readings: string; movements: string; journeys: string }>(
        `SELECT
           (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$1::uuid) AS readings,
           (SELECT count(*)::text FROM gacor.movimientos_vehiculo WHERE uuid_operacion=$1::uuid) AS movements,
           (SELECT count(*)::text FROM gacor.jornadas WHERE uuid_operacion=$1::uuid) AS journeys`,
        [competingStart.operationId],
      );
      expect(competingWrites.rows[0]).toEqual({ readings: '0', movements: '0', journeys: '0' });

      const device = await pool.query<{ id: string }>(
        `INSERT INTO gacor.dispositivos (installation_uuid, usuario_asociado_id, device_token_hash)
         VALUES ($1::uuid, $2::bigint, 'integration-only-hash') RETURNING id::text AS id`,
        [randomUUID(), created.userId],
      );
      created.deviceId = device.rows[0]!.id;
      const authSession = await pool.query<{ id: string }>(
        `INSERT INTO gacor.sesiones_dispositivo (dispositivo_id, usuario_id, refresh_token_hash, ip_login)
         VALUES ($1::bigint, $2::bigint, 'integration-refresh-hash', '127.0.0.1'::inet)
         RETURNING id::text AS id`,
        [created.deviceId, created.userId],
      );
      created.authSessionId = authSession.rows[0]!.id;
      await expect(new AuthRepository(database).findActivePrincipal(created.userId!, created.authSessionId, created.deviceId!))
        .resolves.toEqual([]);
      const trackingSession = await pool.query<{ id: string }>(
        `INSERT INTO gacor.sesiones_seguimiento
           (dispositivo_id, usuario_id, vehiculo_id, movimiento_id, perfil_id, habilitado_por_id)
         SELECT $1::bigint, $2::bigint, $3::bigint, $4::bigint, perfil.id, $2::bigint
         FROM gacor.perfiles_seguimiento perfil WHERE perfil.codigo='NORMAL'
         RETURNING id::text AS id`,
        [created.deviceId, created.userId, created.vehicleId, journey.movement.id],
      );
      created.trackingSessionId = trackingSession.rows[0]!.id;
      const gpsRead = new GpsReadRepository(database);
      expect(await gpsRead.findMySession(created.trackingSessionId, created.userId!)).toMatchObject({ id: created.trackingSessionId });
      expect(await gpsRead.findMySession(created.trackingSessionId, created.foreignUserId!)).toBeNull();
      expect(await gpsRead.findMySessions(created.foreignUserId!, new GpsPageQueryDto())).toMatchObject({ items: [], hasMore: false });
      const gpsHistoryRange = Object.assign(new GpsPositionHistoryQueryDto(), {
        from: '2026-10-15T00:00:00.000Z', to: '2026-10-16T00:00:00.000Z', limit: 10, offset: 0,
      });
      await expect(gpsRead.findSessionPositions(created.trackingSessionId, created.userId!, gpsHistoryRange))
        .resolves.toMatchObject({ items: [], hasMore: false });
      await expect(gpsRead.findSessionPositions(created.trackingSessionId, created.foreignUserId!, gpsHistoryRange))
        .resolves.toBeNull();
      const gps = new GpsPositionRepository(database);
      const gpsInput = {
        sessionId: created.trackingSessionId, deviceId: created.deviceId, longitude: -90.5069, latitude: 14.6349,
        capturedAt: new Date('2026-10-15T12:05:00.000Z'), accuracyMeters: 4.5, speedKmh: 12.25,
        headingDegrees: 180, altitudeMeters: 1200.5, batteryPercentage: 85, operationId: randomUUID(),
      };
      // The official DDL's trg_ultima_gps_notify calls fn_notify_realtime, which
      // references NEW.id although ultima_posicion_gps has no id column.
      await expect(gps.insert(gpsInput)).rejects.toMatchObject({ code: '42703' });
      const failedInsertState = await pool.query<{ points: string; latest: string; tracking_enabled: boolean }>(
        `SELECT
           (SELECT count(*)::text FROM gacor.posiciones_gps WHERE uuid_operacion=$1::uuid) AS points,
           (SELECT count(*)::text FROM gacor.ultima_posicion_gps WHERE dispositivo_id=$2::bigint) AS latest,
           (SELECT tracking_habilitado FROM gacor.dispositivos WHERE id=$2::bigint) AS tracking_enabled`,
        [gpsInput.operationId, created.deviceId],
      );
      expect(failedInsertState.rows[0]).toEqual({ points: '0', latest: '0', tracking_enabled: false });

      const fuelRepository = new FuelRepository(database);
      const fuelInput = {
        userId: created.userId!, movementId: journey.movement.id, operationId: randomUUID(),
        kilometers: '12347.0', deviceAt: '2026-10-15T12:00:00.000Z', gallons: '3.000',
        pricePerGallon: '30.00', totalPaid: '90.00', latitude: '14.6349', longitude: '-90.5069',
        manualPlaceName: 'Integration station', observations: 'Integration fuel', auditIp: '127.0.0.1',
      };
      const [fuel, replayedFuel] = await Promise.all([fuelRepository.create(fuelInput), fuelRepository.create(fuelInput)]);
      expect(fuel).toMatchObject({ movementId: journey.movement.id });
      expect(replayedFuel).toMatchObject({ id: fuel.id, odometerId: fuel.odometerId });
      await expect(fuelRepository.create({ ...fuelInput, totalPaid: '91.00' }))
        .rejects.toBeInstanceOf(FuelIdempotencyConflictError);
      expect(await fuelRepository.findByIdForUser(fuel.id, created.userId!)).toMatchObject({
        id: fuel.id, gallons: '3.000', totalPaid: '90.00', movement: { journeyId: journey.id },
      });
      expect(await fuelRepository.findByIdForUser(fuel.id, '9223372036854775807')).toBeNull();
      expect(await fuelRepository.findHistoryForUser(created.userId!, { limit: 10, offset: 0 })).toHaveLength(1);

      const incidentRepository = new IncidentsRepository(database);
      const incidentInput = {
        userId: created.userId!, type: 'ACCIDENTE' as const, description: `Integration incident ${suffix}`,
        operationId: randomUUID(), latitude: '14.6349', longitude: '-90.5069', auditIp: '127.0.0.1',
      };
      const [incident, replayedIncident] = await Promise.all([
        incidentRepository.create(incidentInput), incidentRepository.create(incidentInput),
      ]);
      created.incidentId = incident.id;
      expect(incident).toMatchObject({ vehicleId: created.vehicleId, movementId: journey.movement.id, type: 'ACCIDENTE', status: 'ABIERTA' });
      expect(replayedIncident).toMatchObject({ id: incident.id });
      await expect(incidentRepository.create({ ...incidentInput, description: 'Changed after replay' }))
        .rejects.toBeInstanceOf(IncidentIdempotencyConflictError);
      expect(await incidentRepository.findByIdForUser(incident.id, created.userId!)).toMatchObject({ id: incident.id });
      expect(await incidentRepository.findByIdForUser(incident.id, '9223372036854775807')).toBeNull();

      const maintenance = new MaintenanceRepository(database);
      const maintenanceInput = {
        userId: created.userId!, auditIp: '127.0.0.1', reason: 'Integration maintenance',
        observations: 'Verify active blocking order constraint',
      };
      const maintenanceAttempts = await Promise.allSettled([
        maintenance.createOrder(maintenanceInput),
        maintenance.createOrder(maintenanceInput),
      ]);
      const createdOrders = maintenanceAttempts.filter((attempt) => attempt.status === 'fulfilled');
      const rejectedOrders = maintenanceAttempts.filter((attempt) => attempt.status === 'rejected');
      expect(createdOrders).toHaveLength(1);
      expect(rejectedOrders).toHaveLength(1);
      if (createdOrders[0]?.status === 'fulfilled') {
        created.maintenanceId = createdOrders[0].value.id;
        expect(createdOrders[0].value).toMatchObject({ vehicleId: created.vehicleId, state: 'ABIERTA', blocksVehicle: true });
      }
      if (rejectedOrders[0]?.status === 'rejected') {
        expect(rejectedOrders[0].reason).toBeInstanceOf(ActiveBlockingMaintenanceOrderError);
      }

      const finish = {
        ...start, journeyId: journey.id, operationId: randomUUID(), kilometers: '12344.9',
        deviceAt: '2026-10-15T17:00:00.000Z', observations: 'Fin de prueba',
      };
      await expect(repository.finish(finish)).rejects.toBeInstanceOf(JourneyConflictError);
      const successfulFinish = { ...finish, kilometers: '12350.5' };
      const finished = await repository.finish(successfulFinish);
      expect(finished).toMatchObject({ state: 'FINALIZADA', movement: { state: 'FINALIZADO' }, finalOdometer: { kilometers: '12350.5' } });
      expect(await repository.finish(successfulFinish)).toMatchObject({ id: journey.id, state: 'FINALIZADA' });
    } finally {
      if (created.deviceId) await pool.query('DELETE FROM gacor.ultima_posicion_gps WHERE dispositivo_id=$1::bigint', [created.deviceId]);
      if (created.trackingSessionId) await pool.query('DELETE FROM gacor.posiciones_gps WHERE sesion_seguimiento_id=$1::bigint', [created.trackingSessionId]);
      if (created.trackingSessionId) await pool.query('DELETE FROM gacor.sesiones_seguimiento WHERE id=$1::bigint', [created.trackingSessionId]);
      if (created.authSessionId) await pool.query('DELETE FROM gacor.sesiones_dispositivo WHERE id=$1::bigint', [created.authSessionId]);
      if (created.deviceId) await pool.query('DELETE FROM gacor.dispositivos WHERE id=$1::bigint', [created.deviceId]);
      if (created.maintenanceId) await pool.query('DELETE FROM gacor.ordenes_mantenimiento WHERE id=$1::bigint', [created.maintenanceId]);
      if (created.vehicleId) {
        await pool.query(`UPDATE gacor.vehiculos SET estado_operativo='DISPONIBLE'::gacor.estado_operativo_vehiculo_enum WHERE id=$1::bigint`, [created.vehicleId]);
      }
      if (created.incidentId) await pool.query('DELETE FROM gacor.incidencias WHERE id=$1::bigint', [created.incidentId]);
      if (created.assignmentId) {
        await pool.query('DELETE FROM gacor.jornadas WHERE asignacion_id=$1::bigint', [created.assignmentId]);
      }
      if (created.vehicleId && created.userId) {
        await pool.query(
          `DELETE FROM gacor.cargas_combustible cc USING gacor.movimientos_vehiculo mv
           WHERE cc.movimiento_id=mv.id AND mv.vehiculo_id=$1::bigint AND mv.usuario_id=$2::bigint`,
          [created.vehicleId, created.userId],
        );
        await pool.query('DELETE FROM gacor.movimientos_vehiculo WHERE vehiculo_id=$1::bigint AND usuario_id=$2::bigint', [created.vehicleId, created.userId]);
        await pool.query('DELETE FROM gacor.lecturas_odometro WHERE vehiculo_id=$1::bigint AND usuario_id=$2::bigint', [created.vehicleId, created.userId]);
      }
      if (created.assignmentId) await pool.query('DELETE FROM gacor.asignaciones_vehiculo WHERE id=$1::bigint', [created.assignmentId]);
      if (created.vehicleId) await pool.query('DELETE FROM gacor.vehiculos WHERE id=$1::bigint', [created.vehicleId]);
      if (created.brigadeId) await pool.query('DELETE FROM gacor.brigadas WHERE id=$1::bigint', [created.brigadeId]);
      if (created.userId) await pool.query('DELETE FROM gacor.usuarios WHERE id=$1::bigint', [created.userId]);
      if (created.foreignUserId) await pool.query('DELETE FROM gacor.usuarios WHERE id=$1::bigint', [created.foreignUserId]);
      await removeFixtureAuditSince(auditBoundary);
    }
  }, 30_000);

  it('creates and safely replays an administrative loan request, rejects conflicts, and scopes reads', async () => {
    const suffix = randomUUID();
    const created: { ownerId?: string; foreignId?: string; vehicleId?: string; cabinetId?: string; keyringId?: string; positionId?: string; loanId?: string } = {};
    let auditBoundary: string | undefined;
    try {
      auditBoundary = await captureAuditBoundary();
      const owner = await pool.query<{ id: string }>(
        `INSERT INTO gacor.usuarios (nombres, apellidos, correo, password_hash)
         VALUES ('Integration', 'Loan Owner', $1, 'test-only-hash') RETURNING id::text AS id`,
        [`loan-owner-${suffix}@example.invalid`],
      );
      created.ownerId = owner.rows[0]!.id;
      const foreign = await pool.query<{ id: string }>(
        `INSERT INTO gacor.usuarios (nombres, apellidos, correo, password_hash)
         VALUES ('Integration', 'Foreign User', $1, 'test-only-hash') RETURNING id::text AS id`,
        [`loan-foreign-${suffix}@example.invalid`],
      );
      created.foreignId = foreign.rows[0]!.id;
      const vehicle = await pool.query<{ id: string }>(
        `INSERT INTO gacor.vehiculos (placa, marca, tipo)
         VALUES ($1, 'Integration', 'ADMINISTRATIVO'::gacor.tipo_vehiculo_enum) RETURNING id::text AS id`,
        [`LN-${suffix.slice(0, 12)}`],
      );
      created.vehicleId = vehicle.rows[0]!.id;
      const cabinet = await pool.query<{ id: string }>(
        `INSERT INTO gacor.gabinetes (nombre, identificador_esp32, estado)
         VALUES ('Integration cabinet', $1, 'ONLINE'::gacor.estado_gabinete_enum) RETURNING id::text AS id`,
        [`it-${suffix}`],
      );
      created.cabinetId = cabinet.rows[0]!.id;
      const keyring = await pool.query<{ id: string }>(
        `INSERT INTO gacor.llaveros (vehiculo_id, chip_uid)
         VALUES ($1::bigint, $2) RETURNING id::text AS id`,
        [created.vehicleId, `chip-${suffix}`],
      );
      created.keyringId = keyring.rows[0]!.id;
      const position = await pool.query<{ id: string }>(
        `INSERT INTO gacor.posiciones_gabinete (gabinete_id, numero_posicion, llavero_actual_id)
         VALUES ($1::bigint, 1, $2::bigint) RETURNING id::text AS id`,
        [created.cabinetId, created.keyringId],
      );
      created.positionId = position.rows[0]!.id;

      const repository = new LoanRequestRepository(database);
      const input = {
        vehicleId: created.vehicleId!, userId: created.ownerId!, operationId: randomUUID(),
        destination: 'Operations office', reason: 'Integration verification', auditIp: '127.0.0.1',
      };
      const [request, retriedRequest] = await Promise.all([repository.create(input), repository.create(input)]);
      created.loanId = request.id;
      expect(request).toMatchObject({ vehicleId: created.vehicleId, status: 'SOLICITADO', destination: input.destination, reason: input.reason });
      expect(retriedRequest).toMatchObject({ id: request.id });
      await expect(repository.create({ ...input, reason: 'Changed after replay' }))
        .rejects.toBeInstanceOf(LoanRequestIdempotencyConflictError);
      await expect(repository.create({ ...input, operationId: randomUUID() }))
        .rejects.toBeInstanceOf(LoanRequestUnavailableError);
      expect(await repository.findByIdForUser(request.id, created.foreignId!)).toBeNull();
      expect(await repository.findByIdForUser(request.id, created.ownerId!)).toMatchObject({ id: request.id });
    } finally {
      if (created.loanId) await pool.query('DELETE FROM gacor.prestamos_administrativos WHERE id=$1::bigint', [created.loanId]);
      if (created.positionId) await pool.query('DELETE FROM gacor.posiciones_gabinete WHERE id=$1::bigint', [created.positionId]);
      if (created.keyringId) await pool.query('DELETE FROM gacor.llaveros WHERE id=$1::bigint', [created.keyringId]);
      if (created.cabinetId) await pool.query('DELETE FROM gacor.gabinetes WHERE id=$1::bigint', [created.cabinetId]);
      if (created.vehicleId) await pool.query('DELETE FROM gacor.vehiculos WHERE id=$1::bigint', [created.vehicleId]);
      if (created.ownerId) await pool.query('DELETE FROM gacor.usuarios WHERE id=$1::bigint', [created.ownerId]);
      if (created.foreignId) await pool.query('DELETE FROM gacor.usuarios WHERE id=$1::bigint', [created.foreignId]);
      await removeFixtureAuditSince(auditBoundary);
    }
  }, 30_000);

  it('verifies HTTP login, per-request permission checks, profile privacy, and revocation with an isolated fixture', async () => {
    const originalEnvironment = { ...process.env };
    let application: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
    let userId: string | undefined;
    let deviceId: string | undefined;
    let administrativeUserId: string | undefined;
    let administrativeDeviceId: string | undefined;
    let foreignUserId: string | undefined;
    let foreignDeviceId: string | undefined;
    let brigadeId: string | undefined;
    let vehicleId: string | undefined;
    let assignmentId: string | undefined;
    let foreignBrigadeId: string | undefined;
    let foreignVehicleId: string | undefined;
    let foreignAssignmentId: string | undefined;
    let journeyId: string | undefined;
    let secondJourneyId: string | undefined;
    let foreignJourneyId: string | undefined;
    let fuelId: string | undefined;
    let incidentId: string | undefined;
    let emergencyIncidentId: string | undefined;
    let pilotRoleId: string | undefined;
    let pilotPermissionCodes: string[] = [];
    let pilotRolePermissionsApplied = false;
    let administrativePilotRoleId: string | undefined;
    let administrativeVehiclePermissionId: string | undefined;
    let administrativeRolePermissionApplied = false;
    let administrativeUserRoleApplied = false;
    const administrativeVehicleIds: string[] = [];
    const administrativeAvailabilityCabinetIds: string[] = [];
    const administrativeAvailabilityKeyringIds: string[] = [];
    const administrativeAvailabilityPositionIds: string[] = [];
    const expectedAdministrativeAvailabilityVehicleIds: string[] = [];
    let inactiveAdministrativeAvailabilityVehicleId: string | undefined;
    const administrativeMovementIds: string[] = [];
    const administrativeLoanIds: string[] = [];
    const administrativeReadingIds: string[] = [];
    let auditBoundary: string | undefined;
    let baseUrl: string | undefined;
    let foreignAccessToken: string | undefined;
    let administrativeAccessToken: string | undefined;
    try {
      auditBoundary = await captureAuditBoundary();
      const email = `http-auth-${randomUUID()}@example.invalid`;
      const password = randomBytes(32).toString('base64url');
      const deviceToken = randomBytes(32).toString('base64url');
      const foreignEmail = `http-foreign-${randomUUID()}@example.invalid`;
      const foreignPassword = randomBytes(32).toString('base64url');
      const foreignDeviceToken = randomBytes(32).toString('base64url');
      const passwordHash = await new PasswordHasher().hash(password);
      const deviceTokenHash = new OpaqueTokenService().hash(deviceToken);
      const user = await pool.query<{ id: string }>(
        `INSERT INTO gacor.usuarios (nombres, apellidos, correo, password_hash)
         VALUES ('HTTP', 'Isolated Auth', $1, $2) RETURNING id::text AS id`, [email, passwordHash],
      );
      userId = user.rows[0]!.id;
      const device = await pool.query<{ id: string }>(
        `INSERT INTO gacor.dispositivos (installation_uuid, usuario_asociado_id, device_token_hash)
         VALUES ($1::uuid, $2::bigint, $3) RETURNING id::text AS id`,
        [randomUUID(), userId, deviceTokenHash],
      );
      deviceId = device.rows[0]!.id;
      const foreignPasswordHash = await new PasswordHasher().hash(foreignPassword);
      const foreignUser = await pool.query<{ id: string }>(
        `INSERT INTO gacor.usuarios (nombres, apellidos, correo, password_hash)
         VALUES ('HTTP', 'Foreign Pilot', $1, $2) RETURNING id::text AS id`, [foreignEmail, foreignPasswordHash],
      );
      foreignUserId = foreignUser.rows[0]!.id;
      const foreignDevice = await pool.query<{ id: string }>(
        `INSERT INTO gacor.dispositivos (installation_uuid, usuario_asociado_id, device_token_hash)
         VALUES ($1::uuid, $2::bigint, $3) RETURNING id::text AS id`,
        [randomUUID(), foreignUserId, new OpaqueTokenService().hash(foreignDeviceToken)],
      );
      foreignDeviceId = foreignDevice.rows[0]!.id;
      const administrativeEmail = `http-admin-movement-${randomUUID()}@example.invalid`;
      const administrativePassword = randomBytes(32).toString('base64url');
      const administrativeDeviceToken = randomBytes(32).toString('base64url');
      const administrativePasswordHash = await new PasswordHasher().hash(administrativePassword);
      const administrativeUser = await pool.query<{ id: string }>(
        `INSERT INTO gacor.usuarios (nombres, apellidos, correo, password_hash)
         VALUES ('HTTP', 'Administrative Movement Pilot', $1, $2) RETURNING id::text AS id`,
        [administrativeEmail, administrativePasswordHash],
      );
      administrativeUserId = administrativeUser.rows[0]!.id;
      const administrativeDevice = await pool.query<{ id: string }>(
        `INSERT INTO gacor.dispositivos (installation_uuid, usuario_asociado_id, device_token_hash)
         VALUES ($1::uuid, $2::bigint, $3) RETURNING id::text AS id`,
        [randomUUID(), administrativeUserId, new OpaqueTokenService().hash(administrativeDeviceToken)],
      );
      administrativeDeviceId = administrativeDevice.rows[0]!.id;

      // Exercise the approved pilot proposal only in this disposable database.
      const role = await pool.query<{ id: string }>(
        `SELECT id::text AS id FROM gacor.roles WHERE codigo='PILOTO_BRIGADA' AND activo`,
      );
      if (role.rowCount !== 1) throw new Error('Expected exactly one active PILOTO_BRIGADA role in the isolated fixture database');
      pilotRoleId = role.rows[0]!.id;
      pilotPermissionCodes = [
        'VEHICULO_USAR_ASIGNADO', 'JORNADA_INICIAR', 'JORNADA_FINALIZAR', 'COMBUSTIBLE_REPORTAR', 'INCIDENCIA_REPORTAR',
      ];
      const permissionRows = await pool.query<{ codigo: string }>(
        `SELECT codigo FROM gacor.permisos WHERE codigo = ANY($1::text[]) AND activo`, [pilotPermissionCodes],
      );
      if (permissionRows.rowCount !== pilotPermissionCodes.length) throw new Error('Pilot permission fixture does not match the seeded permission catalog');
      const existingLinks = await pool.query(
        `SELECT 1 FROM gacor.rol_permiso WHERE rol_id=$1::bigint AND permiso_id IN
           (SELECT id FROM gacor.permisos WHERE codigo = ANY($2::text[])) LIMIT 1`,
        [pilotRoleId, pilotPermissionCodes],
      );
      if (existingLinks.rowCount) throw new Error('Pilot permission fixture requires the selected role-permission links to be absent');
      const brigade = await pool.query<{ id: string }>(
        `INSERT INTO gacor.brigadas (codigo, nombre) VALUES ($1, 'HTTP integration brigade') RETURNING id::text AS id`,
        [`HTTP-${randomUUID()}`],
      );
      brigadeId = brigade.rows[0]!.id;
      const vehicle = await pool.query<{ id: string }>(
        `INSERT INTO gacor.vehiculos (brigada_id, placa, marca, tipo)
         VALUES ($1::bigint, $2, 'Integration', 'BRIGADA'::gacor.tipo_vehiculo_enum) RETURNING id::text AS id`,
        [brigadeId, `HTTP-${randomUUID().slice(0, 12)}`],
      );
      vehicleId = vehicle.rows[0]!.id;
      const assignment = await pool.query<{ id: string }>(
        `INSERT INTO gacor.asignaciones_vehiculo (vehiculo_id, piloto_id, asignado_por_id)
         VALUES ($1::bigint, $2::bigint, $2::bigint) RETURNING id::text AS id`, [vehicleId, userId],
      );
      assignmentId = assignment.rows[0]!.id;

      process.env.DATABASE_URL = runtimeDatabaseUrl;
      process.env.PGSSL = 'disable';
      for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) delete process.env[key];
      process.env.AUTH_TOKEN_SECRET = randomBytes(48).toString('base64url');
      process.env.NODE_ENV = 'test';
      application = await NestFactory.create(AppModule, { logger: false });
      const express = application.getHttpAdapter().getInstance();
      express.set('trust proxy', false);
      application.use(requestIdMiddleware);
      application.use(noStoreMiddleware);
      application.use(helmet());
      application.setGlobalPrefix('api/v1');
      setupOpenApi(application);
      application.useGlobalPipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: { target: false, value: false },
      }));
      const logger = application.get(SecureLogger);
      application.useGlobalFilters(new AppExceptionFilter(logger));
      application.useGlobalInterceptors(new RequestLoggingInterceptor(logger));
      await application.listen(0, '127.0.0.1');
      const address = application.getHttpServer().address();
      if (!address || typeof address === 'string') throw new Error('Isolated auth E2E server did not bind to a local port');
      baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

      const unauthenticatedJourneyChecks = await Promise.all([
        fetch(`${baseUrl}/journeys/me/current`),
        fetch(`${baseUrl}/journeys/me/history`),
        fetch(`${baseUrl}/journeys/me`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ operationId: randomUUID(), kilometers: '12345.0', deviceAt: new Date().toISOString() }),
        }),
      ]);
      expect(unauthenticatedJourneyChecks.map((response) => response.status)).toEqual([401, 401, 401]);
      for (const response of unauthenticatedJourneyChecks) {
        const body = await response.json() as Record<string, unknown>;
        expect(body).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', detail: 'Authentication is required' });
        expect(JSON.stringify(body).toLowerCase()).not.toMatch(/journey|vehicle|movement|password|token|hash/);
      }
      const unauthenticatedMovementChecks = await Promise.all([
        fetch(`${baseUrl}/movements/me/assigned`),
        fetch(`${baseUrl}/movements/me/assigned/open`),
        fetch(`${baseUrl}/movements/me/assigned/1`),
      ]);
      expect(unauthenticatedMovementChecks.map((response) => response.status)).toEqual([401, 401, 401]);
      for (const response of unauthenticatedMovementChecks) {
        expect(await response.json()).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', detail: 'Authentication is required' });
      }
      const unauthenticatedEmergencyResponse = await fetch(`${baseUrl}/incidents/emergencies`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationId: randomUUID(), description: 'Unauthenticated emergency fixture' }),
      });
      expect(unauthenticatedEmergencyResponse.status).toBe(401);
      const unauthenticatedAdministrativeMovementChecks = await Promise.all([
        fetch(`${baseUrl}/movements/me/administrative`),
        fetch(`${baseUrl}/movements/me/administrative/open`),
        fetch(`${baseUrl}/movements/me/administrative/1`),
      ]);
      expect(unauthenticatedAdministrativeMovementChecks.map((response) => response.status)).toEqual([401, 401, 401]);
      for (const response of unauthenticatedAdministrativeMovementChecks) {
        expect(await response.json()).toMatchObject({ status: 401, code: 'UNAUTHENTICATED', detail: 'Authentication is required' });
      }
      const unauthenticatedAdministrativeVehiclesResponse = await fetch(`${baseUrl}/vehicles/administrative/available`);
      expect(unauthenticatedAdministrativeVehiclesResponse.status).toBe(401);
      const unauthenticatedAdministrativeVehiclesBody = await unauthenticatedAdministrativeVehiclesResponse.json() as Record<string, unknown>;
      expect(unauthenticatedAdministrativeVehiclesBody).toMatchObject({
        status: 401, code: 'UNAUTHENTICATED', detail: 'Authentication is required',
      });
      expect(JSON.stringify(unauthenticatedAdministrativeVehiclesBody)).not.toMatch(/plate|vehicle|cabinet|position/i);

      const loginResults = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/auth/sessions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId, deviceToken }),
      })));
      expect(loginResults.map((response) => response.status).sort()).toEqual([201, 409]);
      const loginResponse = loginResults.find((response) => response.status === 201)!;
      expect(loginResponse.headers.get('cache-control')).toBe('no-store');
      const tokenPair = await loginResponse.json() as {
        accessToken: string; refreshToken: string; sessionId: string; tokenType: string; expiresIn: number;
      };
      expect(tokenPair).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });

      const profileResponse = await fetch(`${baseUrl}/users/me`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } });
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.headers.get('cache-control')).toBe('no-store');
      const profile = await profileResponse.json() as Record<string, unknown>;
      expect(profile).toMatchObject({ id: userId, email });
      expect(Object.keys(profile).join(' ').toLowerCase()).not.toMatch(/password|token|secret|hash/);

      const accessResponse = await fetch(`${baseUrl}/users/me/access`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(accessResponse.status).toBe(200);
      expect(await accessResponse.json()).toMatchObject({ roles: [], permissions: [] });

      const ownDeviceStatusResponse = await fetch(`${baseUrl}/gps/me/device-status`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownDeviceStatusResponse.status).toBe(200);
      expect(ownDeviceStatusResponse.headers.get('cache-control')).toBe('no-store');
      const ownDeviceStatus = await ownDeviceStatusResponse.json() as Record<string, unknown>;
      expect(ownDeviceStatus).toMatchObject({ id: deviceId });
      expect(Object.keys(ownDeviceStatus).join(' ').toLowerCase()).not.toMatch(/device.?token|push.?token|secret|hash/);
      const ownLatestGpsResponse = await fetch(`${baseUrl}/gps/me/latest`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownLatestGpsResponse.status).toBe(200);
      expect(await ownLatestGpsResponse.json()).toBeNull();

      const openApiResponse = await fetch(`${baseUrl}/docs/openapi.json`);
      expect(openApiResponse.status).toBe(200);
      const openApi = await openApiResponse.json() as {
        paths: Record<string, Record<string, { 'x-required-permissions'?: unknown }>>;
      };
      const protectedGetPaths = Object.entries(openApi.paths).flatMap(([path, operations]) => {
        const operation = operations['get'];
        return Array.isArray(operation?.['x-required-permissions']) && operation['x-required-permissions'].length > 0
          ? [path]
          : [];
      });
      expect(protectedGetPaths.length).toBeGreaterThan(10);
      const deniedResponses = await Promise.all(protectedGetPaths.map((path) => fetch(
        `${new URL(baseUrl!).origin}${path.replace(/\{[^/]+\}/g, '1')}`,
        { headers: { authorization: `Bearer ${tokenPair.accessToken}` } },
      )));
      expect(deniedResponses.map((response) => response.status)).toEqual(protectedGetPaths.map(() => 403));
      const deniedMovementChecks = await Promise.all([
        fetch(`${baseUrl}/movements/me/assigned`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } }),
        fetch(`${baseUrl}/movements/me/assigned/open`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } }),
        fetch(`${baseUrl}/movements/me/assigned/1`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } }),
      ]);
      expect(deniedMovementChecks.map((response) => response.status)).toEqual([403, 403, 403]);
      for (const response of deniedMovementChecks) {
        expect(await response.json()).toMatchObject({ status: 403, code: 'FORBIDDEN', detail: 'The operation is not permitted' });
      }
      const deniedJourneyStart = await fetch(`${baseUrl}/journeys/me`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ operationId: randomUUID(), kilometers: '12345.0', deviceAt: new Date().toISOString() }),
      });
      expect(deniedJourneyStart.status).toBe(403);
      const deniedFuelReport = await fetch(`${baseUrl}/fuel`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({
          movementId: '1', operationId: randomUUID(), kilometers: '12346.0', deviceAt: new Date().toISOString(),
          gallons: '1.000', pricePerGallon: '30.00', totalPaid: '30.00',
        }),
      });
      expect(deniedFuelReport.status).toBe(403);
      const deniedIncidentReport = await fetch(`${baseUrl}/incidents`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ type: 'ACCIDENTE', description: 'Denied fixture incident', operationId: randomUUID() }),
      });
      expect(deniedIncidentReport.status).toBe(403);
      const deniedEmergencyOperationId = randomUUID();
      const deniedEmergencyReport = await fetch(`${baseUrl}/incidents/emergencies`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ operationId: deniedEmergencyOperationId, description: 'Denied fixture emergency' }),
      });
      expect(deniedEmergencyReport.status).toBe(403);
      const deniedEmergencyCount = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM gacor.incidencias WHERE uuid_operacion=$1::uuid', [deniedEmergencyOperationId],
      );
      expect(deniedEmergencyCount.rows[0]?.count).toBe('0');

      await pool.query(
        `INSERT INTO gacor.usuario_rol (usuario_id, rol_id) VALUES ($1::bigint, $2::bigint)`, [userId, pilotRoleId],
      );
      await pool.query(
        `INSERT INTO gacor.usuario_rol (usuario_id, rol_id) VALUES ($1::bigint, $2::bigint)`, [foreignUserId, pilotRoleId],
      );
      await pool.query(
        `INSERT INTO gacor.rol_permiso (rol_id, permiso_id)
         SELECT $1::bigint, id FROM gacor.permisos WHERE codigo = ANY($2::text[])`, [pilotRoleId, pilotPermissionCodes],
      );
      pilotRolePermissionsApplied = true;
      const foreignLoginResponse = await fetch(`${baseUrl}/auth/sessions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: foreignEmail, password: foreignPassword, deviceId: foreignDeviceId, deviceToken: foreignDeviceToken }),
      });
      expect(foreignLoginResponse.status).toBe(201);
      const foreignTokenPair = await foreignLoginResponse.json() as { accessToken: string };
      foreignAccessToken = foreignTokenPair.accessToken;
      const noAssignmentEmergencyOperationId = randomUUID();
      const noAssignmentEmergencyResponse = await fetch(`${baseUrl}/incidents/emergencies`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${foreignAccessToken}` },
        body: JSON.stringify({ operationId: noAssignmentEmergencyOperationId, description: 'No-assignment emergency fixture' }),
      });
      expect(noAssignmentEmergencyResponse.status).toBe(404);
      const noAssignmentEmergencyCount = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM gacor.incidencias WHERE uuid_operacion=$1::uuid', [noAssignmentEmergencyOperationId],
      );
      expect(noAssignmentEmergencyCount.rows[0]?.count).toBe('0');
      const foreignAccessResponse = await fetch(`${baseUrl}/users/me/access`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignAccessResponse.status).toBe(200);
      expect(await foreignAccessResponse.json()).toMatchObject({
        roles: expect.arrayContaining([expect.objectContaining({ code: 'PILOTO_BRIGADA' })]),
        permissions: expect.arrayContaining([expect.objectContaining({ code: 'JORNADA_INICIAR' })]),
      });
      const foreignListChecks = await Promise.all([
        fetch(`${baseUrl}/vehicles/assigned`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
        fetch(`${baseUrl}/assignments/me/active`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
        fetch(`${baseUrl}/journeys/me/current`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
        fetch(`${baseUrl}/journeys/me/history`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
        fetch(`${baseUrl}/fuel/me/history`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
        fetch(`${baseUrl}/incidents/me/history`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
      ]);
      expect(foreignListChecks.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200]);
      expect(await foreignListChecks[0]!.json()).toBeNull();
      expect(await foreignListChecks[1]!.json()).toBeNull();
      expect(await foreignListChecks[2]!.json()).toBeNull();
      for (const response of foreignListChecks.slice(3)) {
        expect(await response.json()).toMatchObject({ items: [] });
      }
      const emptyAssignedMovementHistory = await fetch(`${baseUrl}/movements/me/assigned`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(emptyAssignedMovementHistory.status).toBe(200);
      expect(await emptyAssignedMovementHistory.json()).toEqual({
        items: [], hasMore: false, pagination: { limit: 25, offset: 0, hasMore: false },
      });
      const emptyAssignedOpenMovement = await fetch(`${baseUrl}/movements/me/assigned/open`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(emptyAssignedOpenMovement.status).toBe(404);
      expect(await emptyAssignedOpenMovement.json()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
      const assignedPilotWithoutMovements = await fetch(`${baseUrl}/movements/me/assigned`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(assignedPilotWithoutMovements.status).toBe(200);
      expect(await assignedPilotWithoutMovements.json()).toEqual({
        items: [], hasMore: false, pagination: { limit: 25, offset: 0, hasMore: false },
      });
      const assignedPilotWithoutOpenMovement = await fetch(`${baseUrl}/movements/me/assigned/open`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(assignedPilotWithoutOpenMovement.status).toBe(404);
      expect(await assignedPilotWithoutOpenMovement.json()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
      const grantedAccessResponse = await fetch(`${baseUrl}/users/me/access`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(grantedAccessResponse.status).toBe(200);
      const grantedAccess = await grantedAccessResponse.json() as {
        roles: Array<{ code: string }>;
        permissions: Array<{ code: string }>;
      };
      expect(grantedAccess.roles.map(({ code }) => code)).toContain('PILOTO_BRIGADA');
      expect(grantedAccess.permissions.map(({ code }) => code).sort()).toEqual([...pilotPermissionCodes].sort());
      expect(grantedAccess.permissions.map(({ code }) => code)).not.toContain('VEHICULO_USAR_ADMINISTRATIVO');
      const deniedAdministrativeMovementChecks = await Promise.all([
        fetch(`${baseUrl}/movements/me/administrative`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } }),
        fetch(`${baseUrl}/movements/me/administrative/open`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } }),
        fetch(`${baseUrl}/movements/me/administrative/1`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } }),
      ]);
      expect(deniedAdministrativeMovementChecks.map((response) => response.status)).toEqual([403, 403, 403]);
      for (const response of deniedAdministrativeMovementChecks) {
        expect(await response.json()).toMatchObject({ status: 403, code: 'FORBIDDEN', detail: 'The operation is not permitted' });
      }

      const administrativeRole = await pool.query<{ id: string }>(
        `SELECT id::text AS id FROM gacor.roles WHERE codigo='PILOTO_ADMINISTRATIVO' AND activo`,
      );
      expect(administrativeRole.rowCount).toBe(1);
      administrativePilotRoleId = administrativeRole.rows[0]!.id;
      const administrativePermission = await pool.query<{ id: string }>(
        `SELECT id::text AS id FROM gacor.permisos WHERE codigo='VEHICULO_USAR_ADMINISTRATIVO' AND activo`,
      );
      expect(administrativePermission.rowCount).toBe(1);
      administrativeVehiclePermissionId = administrativePermission.rows[0]!.id;
      const administrativeAssociationPreState = await pool.query<{ role_permission_links: string; fixture_user_role_links: string }>(
        `SELECT
           (SELECT count(*)::text FROM gacor.rol_permiso WHERE rol_id=$1::bigint AND permiso_id=$2::bigint) AS role_permission_links,
           (SELECT count(*)::text FROM gacor.usuario_rol WHERE usuario_id=$3::bigint AND rol_id=$1::bigint) AS fixture_user_role_links`,
        [administrativePilotRoleId, administrativeVehiclePermissionId, administrativeUserId],
      );
      expect(administrativeAssociationPreState.rows[0]).toEqual({ role_permission_links: '0', fixture_user_role_links: '0' });
      const createdAdministrativeRolePermission = await pool.query(
        `INSERT INTO gacor.rol_permiso (rol_id, permiso_id) VALUES ($1::bigint, $2::bigint) RETURNING rol_id`,
        [administrativePilotRoleId, administrativeVehiclePermissionId],
      );
      expect(createdAdministrativeRolePermission.rowCount).toBe(1);
      administrativeRolePermissionApplied = true;
      const createdAdministrativeUserRole = await pool.query(
        `INSERT INTO gacor.usuario_rol (usuario_id, rol_id) VALUES ($1::bigint, $2::bigint) RETURNING usuario_id`,
        [administrativeUserId, administrativePilotRoleId],
      );
      expect(createdAdministrativeUserRole.rowCount).toBe(1);
      administrativeUserRoleApplied = true;
      const administrativeLoginResponse = await fetch(`${baseUrl}/auth/sessions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: administrativeEmail, password: administrativePassword,
          deviceId: administrativeDeviceId, deviceToken: administrativeDeviceToken,
        }),
      });
      expect(administrativeLoginResponse.status).toBe(201);
      const administrativeTokenPair = await administrativeLoginResponse.json() as { accessToken: string };
      administrativeAccessToken = administrativeTokenPair.accessToken;
      const administrativeAccessResponse = await fetch(`${baseUrl}/users/me/access`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(administrativeAccessResponse.status).toBe(200);
      const administrativeAccess = await administrativeAccessResponse.json() as {
        roles: Array<{ code: string }>;
        permissions: Array<{ code: string }>;
      };
      expect(administrativeAccess.roles.map(({ code }) => code)).toContain('PILOTO_ADMINISTRATIVO');
      expect(administrativeAccess.permissions.map(({ code }) => code)).toEqual(['VEHICULO_USAR_ADMINISTRATIVO']);

      const baselineAdministrativeAvailability = await pool.query<{ vehicle_id: string; cabinet_id: string }>(
        `SELECT vehiculo_id::text AS vehicle_id, gabinete_id::text AS cabinet_id
         FROM gacor.vw_vehiculos_administrativos_disponibles ORDER BY vehiculo_id`,
      );
      const createAvailabilityFixture = async (suffix: string, active: boolean) => {
        const vehicle = await pool.query<{ id: string }>(
          `INSERT INTO gacor.vehiculos (placa, marca, tipo, activo)
           VALUES ($1, 'HTTP availability fixture', 'ADMINISTRATIVO'::gacor.tipo_vehiculo_enum, $2)
           RETURNING id::text AS id`, [`AV-${randomUUID().slice(0, 12)}`, active],
        );
        administrativeVehicleIds.push(vehicle.rows[0]!.id);
        const cabinet = await pool.query<{ id: string }>(
          `INSERT INTO gacor.gabinetes (nombre, identificador_esp32, estado)
           VALUES ($1, $2, 'ONLINE'::gacor.estado_gabinete_enum) RETURNING id::text AS id`,
          [`HTTP availability ${suffix}`, `http-availability-${randomUUID()}`],
        );
        administrativeAvailabilityCabinetIds.push(cabinet.rows[0]!.id);
        const keyring = await pool.query<{ id: string }>(
          `INSERT INTO gacor.llaveros (vehiculo_id, chip_uid)
           VALUES ($1::bigint, $2) RETURNING id::text AS id`,
          [vehicle.rows[0]!.id, `http-availability-${randomUUID()}`],
        );
        administrativeAvailabilityKeyringIds.push(keyring.rows[0]!.id);
        const position = await pool.query<{ id: string }>(
          `INSERT INTO gacor.posiciones_gabinete (gabinete_id, numero_posicion, llavero_actual_id)
           VALUES ($1::bigint, 1, $2::bigint) RETURNING id::text AS id`,
          [cabinet.rows[0]!.id, keyring.rows[0]!.id],
        );
        administrativeAvailabilityPositionIds.push(position.rows[0]!.id);
        return { vehicleId: vehicle.rows[0]!.id, cabinetId: cabinet.rows[0]!.id };
      };
      const availableAdministrativeFixtureA = await createAvailabilityFixture('available-a', true);
      const availableAdministrativeFixtureB = await createAvailabilityFixture('available-b', true);
      expectedAdministrativeAvailabilityVehicleIds.push(
        availableAdministrativeFixtureA.vehicleId, availableAdministrativeFixtureB.vehicleId,
      );
      const inactiveAdministrativeFixture = await createAvailabilityFixture('inactive', false);
      inactiveAdministrativeAvailabilityVehicleId = inactiveAdministrativeFixture.vehicleId;

      const administrativeAvailabilityResponse = await fetch(`${baseUrl}/vehicles/administrative/available?limit=100`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(administrativeAvailabilityResponse.status).toBe(200);
      const administrativeAvailability = await administrativeAvailabilityResponse.json() as {
        items: Array<Record<string, unknown> & { id: string; plate: string; make: string; model: string | null;
          cabinetId: string; positionId: string; positionNumber: number; latestOdometer: string | null }>;
        pagination: { limit: number; offset: number; hasMore: boolean };
      };
      const expectedGlobalAvailabilityIds = [
        ...baselineAdministrativeAvailability.rows.map(({ vehicle_id }) => vehicle_id),
        ...expectedAdministrativeAvailabilityVehicleIds,
      ].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
      expect(administrativeAvailability.items.map(({ id }) => id)).toEqual(expectedGlobalAvailabilityIds);
      expect(administrativeAvailability.pagination).toEqual({ limit: 100, offset: 0, hasMore: false });
      for (const item of administrativeAvailability.items.filter(({ id }) => expectedAdministrativeAvailabilityVehicleIds.includes(id))) {
        expect(Object.keys(item).sort()).toEqual([
          'cabinetId', 'id', 'latestOdometer', 'make', 'model', 'plate', 'positionId', 'positionNumber',
        ]);
        expect(item).toMatchObject({
          make: 'HTTP availability fixture',
          cabinetId: item.id === availableAdministrativeFixtureA.vehicleId
            ? availableAdministrativeFixtureA.cabinetId : availableAdministrativeFixtureB.cabinetId,
          positionNumber: 1,
          latestOdometer: null,
        });
      }
      expect(administrativeAvailability.items.some(({ id }) => id === inactiveAdministrativeAvailabilityVehicleId)).toBe(false);

      const administrativeCabinetScopedResponse = await fetch(
        `${baseUrl}/vehicles/administrative/available?cabinetId=${availableAdministrativeFixtureA.cabinetId}&limit=100`,
        { headers: { authorization: `Bearer ${administrativeAccessToken}` } },
      );
      expect(administrativeCabinetScopedResponse.status).toBe(200);
      const administrativeCabinetScoped = await administrativeCabinetScopedResponse.json() as {
        items: Array<{ id: string }>;
        pagination: { limit: number; offset: number; hasMore: boolean };
      };
      const expectedCabinetScopedIds = [
        ...baselineAdministrativeAvailability.rows
          .filter(({ cabinet_id }) => cabinet_id === availableAdministrativeFixtureA.cabinetId)
          .map(({ vehicle_id }) => vehicle_id),
        availableAdministrativeFixtureA.vehicleId,
      ].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
      expect(administrativeCabinetScoped.items.map(({ id }) => id)).toEqual(expectedCabinetScopedIds);
      expect(administrativeCabinetScoped.items.some(({ id }) => id === availableAdministrativeFixtureB.vehicleId)).toBe(false);
      expect(administrativeCabinetScoped.items.some(({ id }) => id === inactiveAdministrativeAvailabilityVehicleId)).toBe(false);
      expect(administrativeCabinetScoped.pagination).toEqual({ limit: 100, offset: 0, hasMore: false });

      const unprivilegedAdministrativeAvailabilityResponse = await fetch(`${baseUrl}/vehicles/administrative/available`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(unprivilegedAdministrativeAvailabilityResponse.status).toBe(403);
      const unprivilegedAdministrativeAvailabilityBody = await unprivilegedAdministrativeAvailabilityResponse.json() as Record<string, unknown>;
      expect(unprivilegedAdministrativeAvailabilityBody).toMatchObject({
        status: 403, code: 'FORBIDDEN', detail: 'The operation is not permitted',
      });
      expect(JSON.stringify(unprivilegedAdministrativeAvailabilityBody)).not.toMatch(/plate|vehicle|cabinet|position/i);

      const foreignAdministrativeAccessResponse = await fetch(`${baseUrl}/users/me/access`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignAdministrativeAccessResponse.status).toBe(200);
      const foreignAdministrativeAccess = await foreignAdministrativeAccessResponse.json() as {
        roles: Array<{ code: string }>;
        permissions: Array<{ code: string }>;
      };
      expect(foreignAdministrativeAccess.roles.map(({ code }) => code)).not.toContain('PILOTO_ADMINISTRATIVO');
      expect(foreignAdministrativeAccess.permissions.map(({ code }) => code)).not.toContain('VEHICULO_USAR_ADMINISTRATIVO');
      const foreignDeniedAdministrativeMovementChecks = await Promise.all([
        fetch(`${baseUrl}/movements/me/administrative`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
        fetch(`${baseUrl}/movements/me/administrative/open`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
        fetch(`${baseUrl}/movements/me/administrative/1`, { headers: { authorization: `Bearer ${foreignAccessToken}` } }),
      ]);
      expect(foreignDeniedAdministrativeMovementChecks.map((response) => response.status)).toEqual([403, 403, 403]);

      const emptyAdministrativeHistoryResponse = await fetch(`${baseUrl}/movements/me/administrative`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(emptyAdministrativeHistoryResponse.status).toBe(200);
      expect(await emptyAdministrativeHistoryResponse.json()).toEqual({
        items: [], hasMore: false, pagination: { limit: 25, offset: 0, hasMore: false },
      });
      const emptyAdministrativeOpenResponse = await fetch(`${baseUrl}/movements/me/administrative/open`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(emptyAdministrativeOpenResponse.status).toBe(404);
      expect(await emptyAdministrativeOpenResponse.json()).toMatchObject({ status: 404, code: 'NOT_FOUND' });

      const administrativeVehicle = await pool.query<{ id: string }>(
        `INSERT INTO gacor.vehiculos (placa, marca, tipo)
         VALUES ($1, 'Fixture Admin', 'ADMINISTRATIVO'::gacor.tipo_vehiculo_enum) RETURNING id::text AS id`,
        [`ADM-${randomUUID().slice(0, 12)}`],
      );
      administrativeVehicleIds.push(administrativeVehicle.rows[0]!.id);
      const foreignAdministrativeVehicle = await pool.query<{ id: string }>(
        `INSERT INTO gacor.vehiculos (placa, marca, tipo)
         VALUES ($1, 'Fixture Foreign Admin', 'ADMINISTRATIVO'::gacor.tipo_vehiculo_enum) RETURNING id::text AS id`,
        [`ADM-${randomUUID().slice(0, 12)}`],
      );
      administrativeVehicleIds.push(foreignAdministrativeVehicle.rows[0]!.id);
      const createFinalizedAdministrativeMovement = async (
        ownerId: string, assignedVehicleId: string, startedAt: Date, startKilometers: string, finishKilometers: string,
      ) => {
        const endedAt = new Date(startedAt.getTime() + 30 * 60_000);
        const startReading = await pool.query<{ id: string }>(
          `INSERT INTO gacor.lecturas_odometro
             (vehiculo_id, usuario_id, kilometraje, tipo_lectura, fecha_hora_dispositivo, uuid_operacion)
           VALUES ($1::bigint, $2::bigint, $3::numeric, 'PRESTAMO_INICIO'::gacor.tipo_lectura_odometro_enum,
             $4::timestamptz, $5::uuid) RETURNING id::text AS id`,
          [assignedVehicleId, ownerId, startKilometers, startedAt, randomUUID()],
        );
        administrativeReadingIds.push(startReading.rows[0]!.id);
        const finishReading = await pool.query<{ id: string }>(
          `INSERT INTO gacor.lecturas_odometro
             (vehiculo_id, usuario_id, kilometraje, tipo_lectura, fecha_hora_dispositivo, uuid_operacion)
           VALUES ($1::bigint, $2::bigint, $3::numeric, 'PRESTAMO_FIN'::gacor.tipo_lectura_odometro_enum,
             $4::timestamptz, $5::uuid) RETURNING id::text AS id`,
          [assignedVehicleId, ownerId, finishKilometers, endedAt, randomUUID()],
        );
        administrativeReadingIds.push(finishReading.rows[0]!.id);
        const movement = await pool.query<{ id: string }>(
          `INSERT INTO gacor.movimientos_vehiculo
             (vehiculo_id, usuario_id, tipo, estado, fecha_hora_inicio, fecha_hora_fin,
              lectura_inicio_id, lectura_fin_id, motivo, uuid_operacion)
           VALUES ($1::bigint, $2::bigint, 'PRESTAMO_ADMINISTRATIVO'::gacor.tipo_movimiento_enum,
             'FINALIZADO'::gacor.estado_movimiento_enum, $3::timestamptz, $4::timestamptz,
             $5::bigint, $6::bigint, 'Isolated HTTP administrative movement fixture', $7::uuid)
           RETURNING id::text AS id`,
          [assignedVehicleId, ownerId, startedAt, endedAt, startReading.rows[0]!.id, finishReading.rows[0]!.id, randomUUID()],
        );
        const movementId = movement.rows[0]!.id;
        administrativeMovementIds.push(movementId);
        const loan = await pool.query<{ id: string }>(
          `INSERT INTO gacor.prestamos_administrativos
             (vehiculo_id, usuario_id, movimiento_id, fecha_hora_solicitud, fecha_hora_inicio_uso,
              fecha_hora_fin_uso, destino, motivo, estado, uuid_operacion)
           VALUES ($1::bigint, $2::bigint, $3::bigint, $4::timestamptz, $5::timestamptz,
             $6::timestamptz, 'Integration fixture', 'HTTP read coverage',
             'FINALIZADO'::gacor.estado_prestamo_enum, $7::uuid)
           RETURNING id::text AS id`,
          [assignedVehicleId, ownerId, movementId, new Date(startedAt.getTime() - 5 * 60_000), startedAt, endedAt, randomUUID()],
        );
        administrativeLoanIds.push(loan.rows[0]!.id);
        return movementId;
      };
      const tiedAdministrativeMovementStart = new Date(Date.now() - 2 * 60 * 60_000);
      const ownAdministrativeMovementOneId = await createFinalizedAdministrativeMovement(
        administrativeUserId!, administrativeVehicle.rows[0]!.id, tiedAdministrativeMovementStart, '30000.0', '30001.0',
      );
      const ownAdministrativeMovementTwoId = await createFinalizedAdministrativeMovement(
        administrativeUserId!, administrativeVehicle.rows[0]!.id, tiedAdministrativeMovementStart, '30100.0', '30101.0',
      );
      const foreignAdministrativeMovementId = await createFinalizedAdministrativeMovement(
        foreignUserId!, foreignAdministrativeVehicle.rows[0]!.id, tiedAdministrativeMovementStart, '40000.0', '40001.0',
      );

      const ownAdministrativeHistoryResponse = await fetch(`${baseUrl}/movements/me/administrative`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(ownAdministrativeHistoryResponse.status).toBe(200);
      const ownAdministrativeHistory = await ownAdministrativeHistoryResponse.json() as {
        items: Array<{ id: string; vehicle: { id: string; plate: string }; type: string; state: string; startedAt: string; endedAt: string | null; journeyId: string | null; loanId: string | null }>;
        hasMore: boolean; pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(Object.keys(ownAdministrativeHistory).sort()).toEqual(['hasMore', 'items', 'pagination']);
      expect(ownAdministrativeHistory.items.map(({ id }) => id)).toEqual([ownAdministrativeMovementTwoId, ownAdministrativeMovementOneId]);
      expect(ownAdministrativeHistory.items.every(({ type, state, vehicle, journeyId: relatedJourneyId, loanId }) =>
        type === 'PRESTAMO_ADMINISTRATIVO' && state === 'FINALIZADO' && vehicle.id === administrativeVehicle.rows[0]!.id
        && relatedJourneyId === null && loanId !== null)).toBe(true);
      expect(ownAdministrativeHistory.items[0]!.startedAt).toBe(ownAdministrativeHistory.items[1]!.startedAt);
      expect(ownAdministrativeHistory.items.every(({ endedAt }) => endedAt !== null)).toBe(true);
      expect(ownAdministrativeHistory).toMatchObject({ hasMore: false, pagination: { limit: 25, offset: 0, hasMore: false } });

      const ownAdministrativeMovementByIdResponse = await fetch(`${baseUrl}/movements/me/administrative/${ownAdministrativeMovementOneId}`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(ownAdministrativeMovementByIdResponse.status).toBe(200);
      expect(await ownAdministrativeMovementByIdResponse.json()).toEqual(ownAdministrativeHistory.items[1]);
      const foreignAdministrativeMovementByIdResponse = await fetch(`${baseUrl}/movements/me/administrative/${foreignAdministrativeMovementId}`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(foreignAdministrativeMovementByIdResponse.status).toBe(404);
      const foreignAdministrativeNotFoundBody = await foreignAdministrativeMovementByIdResponse.json() as Record<string, unknown>;
      expect(foreignAdministrativeNotFoundBody).toMatchObject({ status: 404, code: 'NOT_FOUND', detail: 'The requested resource was not found' });
      expect(Object.keys(foreignAdministrativeNotFoundBody).sort()).toEqual(['code', 'detail', 'requestId', 'status', 'title', 'type']);
      const nonexistentAdministrativeMovementId = '9223372036854775807';
      const nonexistentAdministrativeMovementByIdResponse = await fetch(`${baseUrl}/movements/me/administrative/${nonexistentAdministrativeMovementId}`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(nonexistentAdministrativeMovementByIdResponse.status).toBe(404);
      const nonexistentAdministrativeNotFoundBody = await nonexistentAdministrativeMovementByIdResponse.json() as Record<string, unknown>;
      expect(nonexistentAdministrativeNotFoundBody).toMatchObject({ status: 404, code: 'NOT_FOUND', detail: 'The requested resource was not found' });
      expect(Object.keys(nonexistentAdministrativeNotFoundBody).sort()).toEqual(['code', 'detail', 'requestId', 'status', 'title', 'type']);
      const publicAdministrativeNotFoundShape = ({ type, title, status, code, detail }: Record<string, unknown>) => ({ type, title, status, code, detail });
      expect(publicAdministrativeNotFoundShape(foreignAdministrativeNotFoundBody)).toEqual(publicAdministrativeNotFoundShape(nonexistentAdministrativeNotFoundBody));
      expect(ownAdministrativeHistory.items.some(({ id }) => id === foreignAdministrativeMovementId)).toBe(false);

      for (const query of ['limit=101', 'limit=0', 'offset=2147483648']) {
        const invalidAdministrativeMovementPageResponse = await fetch(`${baseUrl}/movements/me/administrative?${query}`, {
          headers: { authorization: `Bearer ${administrativeAccessToken}` },
        });
        expect(invalidAdministrativeMovementPageResponse.status, query).toBe(400);
        expect(await invalidAdministrativeMovementPageResponse.json()).toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
      }
      const noCurrentJourneyResponse = await fetch(`${baseUrl}/journeys/me/current`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(noCurrentJourneyResponse.status).toBe(200);
      expect(await noCurrentJourneyResponse.text()).toBe('null');

      const foreignBrigade = await pool.query<{ id: string }>(
        `INSERT INTO gacor.brigadas (codigo, nombre) VALUES ($1, 'HTTP foreign pilot brigade') RETURNING id::text AS id`,
        [`HTTP-${randomUUID()}`],
      );
      foreignBrigadeId = foreignBrigade.rows[0]!.id;
      const foreignVehicle = await pool.query<{ id: string }>(
        `INSERT INTO gacor.vehiculos (brigada_id, placa, marca, tipo)
         VALUES ($1::bigint, $2, 'Integration', 'BRIGADA'::gacor.tipo_vehiculo_enum) RETURNING id::text AS id`,
        [foreignBrigadeId, `HTTP-${randomUUID().slice(0, 12)}`],
      );
      foreignVehicleId = foreignVehicle.rows[0]!.id;
      const foreignAssignment = await pool.query<{ id: string }>(
        `INSERT INTO gacor.asignaciones_vehiculo (vehiculo_id, piloto_id, asignado_por_id)
         VALUES ($1::bigint, $2::bigint, $2::bigint) RETURNING id::text AS id`, [foreignVehicleId, foreignUserId],
      );
      foreignAssignmentId = foreignAssignment.rows[0]!.id;
      const foreignJourneyStartResponse = await fetch(`${baseUrl}/journeys/me`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${foreignAccessToken}` },
        body: JSON.stringify({
          operationId: randomUUID(), kilometers: '100.0', deviceAt: new Date().toISOString(),
          observations: 'Isolated HTTP E2E foreign journey',
        }),
      });
      expect(foreignJourneyStartResponse.status).toBe(201);
      const foreignJourney = await foreignJourneyStartResponse.json() as { id: string; state: string; vehicle: { id: string }; movement: { id: string } };
      foreignJourneyId = foreignJourney.id;
      expect(foreignJourney).toMatchObject({ id: foreignJourneyId, state: 'ABIERTA', vehicle: { id: foreignVehicleId } });

      for (const path of ['/vehicles/assigned', '/assignments/me/active']) {
        const response = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } });
        expect(response.status, path).toBe(200);
      }
      const administrativeVehicleResponse = await fetch(`${baseUrl}/vehicles/administrative/available`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(administrativeVehicleResponse.status).toBe(403);
      const administrativeVehicleDeniedBody = await administrativeVehicleResponse.json() as Record<string, unknown>;
      expect(administrativeVehicleDeniedBody).toMatchObject({
        status: 403, code: 'FORBIDDEN', detail: 'The operation is not permitted',
      });
      expect(JSON.stringify(administrativeVehicleDeniedBody)).not.toMatch(/plate|vehicle|cabinet|position/i);

      const invalidJourneyOperationId = randomUUID();
      const invalidJourneyResponse = await fetch(`${baseUrl}/journeys/me`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ operationId: invalidJourneyOperationId, kilometers: 'invalid', deviceAt: new Date().toISOString(), extra: 'rejected' }),
      });
      expect(invalidJourneyResponse.status).toBe(400);
      const invalidJourneyWrites = await pool.query<{ readings: string; movements: string; journeys: string }>(
        `SELECT
           (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$1::uuid) AS readings,
           (SELECT count(*)::text FROM gacor.movimientos_vehiculo WHERE uuid_operacion=$1::uuid) AS movements,
           (SELECT count(*)::text FROM gacor.jornadas WHERE uuid_operacion=$1::uuid) AS journeys`, [invalidJourneyOperationId],
      );
      expect(invalidJourneyWrites.rows[0]).toEqual({ readings: '0', movements: '0', journeys: '0' });
      const invalidFuelOperationId = randomUUID();
      const invalidFuelResponse = await fetch(`${baseUrl}/fuel`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({
          movementId: '1', operationId: invalidFuelOperationId, kilometers: '12345.0', deviceAt: new Date().toISOString(),
          gallons: '0', pricePerGallon: '30.00', totalPaid: '30.00',
        }),
      });
      expect(invalidFuelResponse.status).toBe(400);
      const invalidFuelWrites = await pool.query<{ readings: string; charges: string }>(
        `SELECT
           (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$1::uuid) AS readings,
           (SELECT count(*)::text FROM gacor.cargas_combustible WHERE uuid_operacion=$1::uuid) AS charges`, [invalidFuelOperationId],
      );
      expect(invalidFuelWrites.rows[0]).toEqual({ readings: '0', charges: '0' });
      const invalidIncidentOperationId = randomUUID();
      const invalidIncidentResponse = await fetch(`${baseUrl}/incidents`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ type: 'ACCIDENTE', description: 'Rejected fixture incident', operationId: invalidIncidentOperationId, unexpected: true }),
      });
      expect(invalidIncidentResponse.status).toBe(400);
      const invalidIncidentWrites = await pool.query<{ incidents: string }>(
        'SELECT count(*)::text AS incidents FROM gacor.incidencias WHERE uuid_operacion=$1::uuid', [invalidIncidentOperationId],
      );
      expect(invalidIncidentWrites.rows[0]?.incidents).toBe('0');

      const startAction = {
        operationId: randomUUID(), kilometers: '12345.0', deviceAt: new Date().toISOString(), observations: 'Isolated HTTP E2E start',
      };
      const journeyStartResponse = await fetch(`${baseUrl}/journeys/me`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify(startAction),
      });
      expect(journeyStartResponse.status).toBe(201);
      const startedJourney = await journeyStartResponse.json() as { id: string; state: string; movement: { id: string; state: string } };
      journeyId = startedJourney.id;
      expect(startedJourney).toMatchObject({ state: 'ABIERTA', movement: { state: 'ABIERTO' } });
      const startReplayResponse = await fetch(`${baseUrl}/journeys/me`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify(startAction),
      });
      expect(startReplayResponse.status).toBe(201);
      expect(await startReplayResponse.json()).toMatchObject({ id: journeyId, state: 'ABIERTA' });

      const ownJourneyByIdResponse = await fetch(`${baseUrl}/journeys/${journeyId}`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownJourneyByIdResponse.status).toBe(200);
      const ownJourneyById = await ownJourneyByIdResponse.json() as Record<string, unknown> & {
        id: string;
        state: string;
        movement: { id: string; state: string };
        vehicle: { id: string };
      };
      expect(ownJourneyById).toMatchObject({
        id: journeyId, state: 'ABIERTA', movement: { id: startedJourney.movement.id, state: 'ABIERTO' }, vehicle: { id: vehicleId },
      });
      expect(Object.keys(ownJourneyById).sort()).toEqual([
        'assignmentId', 'createdAt', 'endObservations', 'finalOdometer', 'id', 'initialOdometer',
        'movement', 'startObservations', 'state', 'vehicle',
      ]);

      const ownAssignedOpenMovementResponse = await fetch(`${baseUrl}/movements/me/assigned/open`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownAssignedOpenMovementResponse.status).toBe(200);
      const ownAssignedOpenMovement = await ownAssignedOpenMovementResponse.json() as Record<string, unknown> & {
        id: string; vehicle: { id: string; plate: string }; type: string; state: string;
        startedAt: string; endedAt: string | null; startOdometer: { id: string; kilometers: string };
        endOdometer: unknown; journeyId: string; loanId: string | null;
      };
      expect(ownAssignedOpenMovement).toMatchObject({
        id: startedJourney.movement.id, vehicle: { id: vehicleId }, type: 'JORNADA_BRIGADA', state: 'ABIERTO',
        endedAt: null, journeyId, loanId: null,
      });
      expect(ownAssignedOpenMovement.startOdometer).toMatchObject({ kilometers: '12345.0' });
      expect(ownAssignedOpenMovement.endOdometer).toBeNull();
      expect(Date.parse(ownAssignedOpenMovement.startedAt)).not.toBeNaN();
      expect(Object.keys(ownAssignedOpenMovement).sort()).toEqual([
        'endOdometer', 'endedAt', 'id', 'journeyId', 'loanId', 'startOdometer', 'startedAt', 'state', 'type', 'vehicle',
      ]);
      expect(Object.keys(ownAssignedOpenMovement.vehicle).sort()).toEqual(['id', 'plate']);
      const ownAssignedMovementByIdResponse = await fetch(`${baseUrl}/movements/me/assigned/${startedJourney.movement.id}`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownAssignedMovementByIdResponse.status).toBe(200);
      expect(await ownAssignedMovementByIdResponse.json()).toEqual(ownAssignedOpenMovement);

      const foreignOwnMovementByIdResponse = await fetch(`${baseUrl}/movements/me/assigned/${startedJourney.movement.id}`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignOwnMovementByIdResponse.status).toBe(404);
      const foreignMovementNotFoundBody = await foreignOwnMovementByIdResponse.json() as Record<string, unknown>;
      expect(foreignMovementNotFoundBody).toMatchObject({ status: 404, code: 'NOT_FOUND', detail: 'The requested resource was not found' });
      expect(Object.keys(foreignMovementNotFoundBody).sort()).toEqual(['code', 'detail', 'requestId', 'status', 'title', 'type']);
      const nonexistentMovementId = '9223372036854775807';
      const nonexistentOwnMovementByIdResponse = await fetch(`${baseUrl}/movements/me/assigned/${nonexistentMovementId}`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(nonexistentOwnMovementByIdResponse.status).toBe(404);
      const nonexistentMovementNotFoundBody = await nonexistentOwnMovementByIdResponse.json() as Record<string, unknown>;
      expect(nonexistentMovementNotFoundBody).toMatchObject({ status: 404, code: 'NOT_FOUND', detail: 'The requested resource was not found' });
      expect(Object.keys(nonexistentMovementNotFoundBody).sort()).toEqual(['code', 'detail', 'requestId', 'status', 'title', 'type']);
      const sameNotFoundShape = ({ type, title, status, code, detail }: Record<string, unknown>) => ({ type, title, status, code, detail });
      expect(sameNotFoundShape(foreignMovementNotFoundBody)).toEqual(sameNotFoundShape(nonexistentMovementNotFoundBody));

      const ownMovementHistoryBeforeFinishResponse = await fetch(`${baseUrl}/movements/me/assigned`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownMovementHistoryBeforeFinishResponse.status).toBe(200);
      const ownMovementHistoryBeforeFinish = await ownMovementHistoryBeforeFinishResponse.json() as {
        items: Array<{ id: string; journeyId: string; state: string; vehicle: { id: string } }>;
        hasMore: boolean; pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(ownMovementHistoryBeforeFinish.items).toHaveLength(1);
      expect(ownMovementHistoryBeforeFinish.items[0]).toMatchObject({
        id: startedJourney.movement.id, journeyId, state: 'ABIERTO', vehicle: { id: vehicleId },
      });
      expect(ownMovementHistoryBeforeFinish).toMatchObject({ hasMore: false, pagination: { limit: 25, offset: 0, hasMore: false } });
      expect(Object.keys(ownMovementHistoryBeforeFinish).sort()).toEqual(['hasMore', 'items', 'pagination']);
      const foreignAssignedMovementHistoryResponse = await fetch(`${baseUrl}/movements/me/assigned`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignAssignedMovementHistoryResponse.status).toBe(200);
      const foreignAssignedMovementHistory = await foreignAssignedMovementHistoryResponse.json() as {
        items: Array<{ id: string; journeyId: string; vehicle: { id: string } }>;
      };
      expect(foreignAssignedMovementHistory.items.map(({ id }) => id)).toEqual([foreignJourney.movement.id]);
      expect(foreignAssignedMovementHistory.items.some(({ id }) => id === startedJourney.movement.id)).toBe(false);

      const unauthenticatedJourneyDetailResponse = await fetch(`${baseUrl}/journeys/${journeyId}`);
      expect(unauthenticatedJourneyDetailResponse.status).toBe(401);
      expect(await unauthenticatedJourneyDetailResponse.json()).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });

      const ownCurrentJourneyResponse = await fetch(`${baseUrl}/journeys/me/current`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownCurrentJourneyResponse.status).toBe(200);
      const ownCurrentJourney = await ownCurrentJourneyResponse.json() as Record<string, unknown> & {
        id: string;
        state: string;
        movement: { id: string; state: string };
        vehicle: { id: string; plate: string };
      };
      expect(ownCurrentJourney).toMatchObject({
        id: journeyId,
        state: 'ABIERTA',
        movement: { id: startedJourney.movement.id, state: 'ABIERTO' },
        vehicle: { id: vehicleId },
      });
      expect(Object.keys(ownCurrentJourney).sort()).toEqual([
        'assignmentId', 'createdAt', 'endObservations', 'finalOdometer', 'id', 'initialOdometer',
        'movement', 'startObservations', 'state', 'vehicle',
      ]);
      const unauthenticatedFinishResponse = await fetch(`${baseUrl}/journeys/${journeyId}/finish`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationId: randomUUID(), kilometers: '12346.0', deviceAt: new Date().toISOString() }),
      });
      expect(unauthenticatedFinishResponse.status).toBe(401);
      expect(await unauthenticatedFinishResponse.json()).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });

      const journeyBeforePermissionDeniedFinish = await pool.query(
        `SELECT j.estado::text AS journey_state, j.observaciones_fin, j.updated_at AS journey_updated_at,
                mv.estado::text AS movement_state, mv.fecha_hora_fin, mv.lectura_fin_id::text AS final_reading_id,
                mv.updated_at AS movement_updated_at,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE usuario_id=$2::bigint AND vehiculo_id=$3::bigint) AS odometer_count
         FROM gacor.jornadas j JOIN gacor.movimientos_vehiculo mv ON mv.id=j.movimiento_id
         WHERE j.id=$1::bigint`, [journeyId, userId, vehicleId],
      );
      const removedFinishPermission = await pool.query<{ permiso_id: string }>(
        `DELETE FROM gacor.rol_permiso rp USING gacor.permisos p
         WHERE rp.permiso_id=p.id AND rp.rol_id=$1::bigint AND p.codigo='JORNADA_FINALIZAR'
         RETURNING rp.permiso_id::text AS permiso_id`, [pilotRoleId],
      );
      expect(removedFinishPermission.rowCount).toBe(1);
      let permissionDeniedFinishResponse: Response;
      try {
        permissionDeniedFinishResponse = await fetch(`${baseUrl}/journeys/${journeyId}/finish`, {
          method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
          body: JSON.stringify({ operationId: randomUUID(), kilometers: '12346.0', deviceAt: new Date().toISOString() }),
        });
      } finally {
        await pool.query('INSERT INTO gacor.rol_permiso (rol_id, permiso_id) VALUES ($1::bigint, $2::bigint)', [pilotRoleId, removedFinishPermission.rows[0]!.permiso_id]);
      }
      expect(permissionDeniedFinishResponse!.status).toBe(403);
      expect(await permissionDeniedFinishResponse!.json()).toMatchObject({ status: 403, code: 'FORBIDDEN', detail: 'The operation is not permitted' });
      const journeyAfterPermissionDeniedFinish = await pool.query(
        `SELECT j.estado::text AS journey_state, j.observaciones_fin, j.updated_at AS journey_updated_at,
                mv.estado::text AS movement_state, mv.fecha_hora_fin, mv.lectura_fin_id::text AS final_reading_id,
                mv.updated_at AS movement_updated_at,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE usuario_id=$2::bigint AND vehiculo_id=$3::bigint) AS odometer_count
         FROM gacor.jornadas j JOIN gacor.movimientos_vehiculo mv ON mv.id=j.movimiento_id
         WHERE j.id=$1::bigint`, [journeyId, userId, vehicleId],
      );
      expect(journeyAfterPermissionDeniedFinish.rows).toEqual(journeyBeforePermissionDeniedFinish.rows);
      expect(journeyAfterPermissionDeniedFinish.rows[0]).toMatchObject({ journey_state: 'ABIERTA', movement_state: 'ABIERTO', final_reading_id: null });
      const foreignCurrentJourneyResponse = await fetch(`${baseUrl}/journeys/me/current`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignCurrentJourneyResponse.status).toBe(200);
      expect(await foreignCurrentJourneyResponse.json()).toMatchObject({ id: foreignJourneyId, vehicle: { id: foreignVehicleId } });

      const fuelAction = {
        movementId: startedJourney.movement.id, operationId: randomUUID(), kilometers: '12347.0',
        deviceAt: new Date().toISOString(), gallons: '3.000', pricePerGallon: '30.00', totalPaid: '90.00',
        latitude: '14.6349', longitude: '-90.5069', manualPlaceName: 'Isolated HTTP E2E station',
      };
      const fuelResponses = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/fuel`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify(fuelAction),
      })));
      expect(fuelResponses.map((response) => response.status)).toEqual([201, 201]);
      const fuelReports = await Promise.all(fuelResponses.map((response) => response.json() as Promise<{
        id: string; movementId: string; odometerId: string;
      }>));
      const fuelReport = fuelReports[0]!;
      const replayedFuelReport = fuelReports[1]!;
      fuelId = fuelReport.id;
      expect(fuelReport).toMatchObject({ movementId: startedJourney.movement.id });
      expect(replayedFuelReport).toMatchObject({ id: fuelId, odometerId: fuelReport.odometerId });
      const conflictingFuelResponse = await fetch(`${baseUrl}/fuel`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ ...fuelAction, totalPaid: '91.00' }),
      });
      expect(conflictingFuelResponse.status).toBe(409);
      const fuelOperationCounts = await pool.query<{ charges: string; readings: string }>(
        `SELECT (SELECT count(*)::text FROM gacor.cargas_combustible WHERE uuid_operacion=$1::uuid) AS charges,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$1::uuid) AS readings`,
        [fuelAction.operationId],
      );
      expect(fuelOperationCounts.rows[0]).toEqual({ charges: '1', readings: '1' });
      const fuelReadResponse = await fetch(`${baseUrl}/fuel/${fuelId}`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(fuelReadResponse.status).toBe(200);
      expect(await fuelReadResponse.json()).toMatchObject({
        id: fuelId, gallons: '3.000', totalPaid: '90.00', movement: { journeyId }, odometer: { id: fuelReport.odometerId },
      });
      const foreignFuelReadResponse = await fetch(`${baseUrl}/fuel/${fuelId}`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignFuelReadResponse.status).toBe(404);

      const incidentAction = { type: 'ACCIDENTE', description: 'Isolated HTTP E2E incident', operationId: randomUUID() };
      const incidentResponses = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/incidents`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify(incidentAction),
      })));
      expect(incidentResponses.map((response) => response.status)).toEqual([201, 201]);
      const incidentReports = await Promise.all(incidentResponses.map((response) => response.json() as Promise<{
        id: string; movementId: string; vehicleId: string; status: string;
      }>));
      const incidentReport = incidentReports[0]!;
      const replayedIncidentReport = incidentReports[1]!;
      incidentId = incidentReport.id;
      expect(incidentReport).toMatchObject({ movementId: startedJourney.movement.id, vehicleId, status: 'ABIERTA' });
      expect(replayedIncidentReport).toMatchObject({ id: incidentId });
      const conflictingIncidentResponse = await fetch(`${baseUrl}/incidents`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ ...incidentAction, description: 'Changed after HTTP replay' }),
      });
      expect(conflictingIncidentResponse.status).toBe(409);
      const incidentOperationCount = await pool.query<{ incidents: string }>(
        'SELECT count(*)::text AS incidents FROM gacor.incidencias WHERE uuid_operacion=$1::uuid', [incidentAction.operationId],
      );
      expect(incidentOperationCount.rows[0]?.incidents).toBe('1');

      const emergencyOperationId = randomUUID();
      const invalidEmergencyOperationId = randomUUID();
      const invalidEmergencyResponse = await fetch(`${baseUrl}/incidents/emergencies`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({ operationId: invalidEmergencyOperationId, description: 'Invalid emergency fixture', latitude: '91', longitude: '0' }),
      });
      expect(invalidEmergencyResponse.status).toBe(400);
      const invalidEmergencyCount = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM gacor.incidencias WHERE uuid_operacion=$1::uuid', [invalidEmergencyOperationId],
      );
      expect(invalidEmergencyCount.rows[0]?.count).toBe('0');
      const emergencyPayload = {
        operationId: emergencyOperationId,
        description: 'Isolated HTTP E2E emergency incident',
        latitude: '14.123456',
        longitude: '-90.123456',
      };
      const emergencyResponses = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/incidents/emergencies`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify(emergencyPayload),
      })));
      expect(emergencyResponses.map((response) => response.status)).toEqual([201, 201]);
      const emergencyReports = await Promise.all(emergencyResponses.map((response) => response.json() as Promise<{
        id: string; type: string; vehicleId: string; movementId: string | null; status: string;
        latitude: string; longitude: string; description: string;
      }>));
      emergencyIncidentId = emergencyReports[0]!.id;
      expect(emergencyReports[0]).toMatchObject({
        id: emergencyIncidentId, type: 'PANICO', vehicleId, movementId: startedJourney.movement.id,
        status: 'ABIERTA', latitude: '14.123456', longitude: '-90.123456', description: emergencyPayload.description,
      });
      expect(emergencyReports[1]).toMatchObject({ id: emergencyIncidentId });
      const emergencyOperationCount = await pool.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM gacor.incidencias WHERE uuid_operacion=$1::uuid', [emergencyOperationId],
      );
      expect(emergencyOperationCount.rows[0]?.count).toBe('1');
      const incidentReadResponse = await fetch(`${baseUrl}/incidents/${incidentId}`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(incidentReadResponse.status).toBe(200);
      expect(await incidentReadResponse.json()).toMatchObject({ id: incidentId, movementId: startedJourney.movement.id });
      const foreignIncidentReadResponse = await fetch(`${baseUrl}/incidents/${incidentId}`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignIncidentReadResponse.status).toBe(404);
      const foreignJourneyReadResponse = await fetch(`${baseUrl}/journeys/${journeyId}`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignJourneyReadResponse.status).toBe(404);
      const foreignJourneyNotFoundBody = await foreignJourneyReadResponse.json() as Record<string, unknown>;
      expect(foreignJourneyNotFoundBody).toMatchObject({ status: 404, code: 'NOT_FOUND', detail: 'The requested resource was not found' });
      expect(JSON.stringify(foreignJourneyNotFoundBody)).not.toContain(journeyId);
      const nonexistentJourneyId = '9223372036854775807';
      const nonexistentJourneyReadResponse = await fetch(`${baseUrl}/journeys/${nonexistentJourneyId}`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(nonexistentJourneyReadResponse.status).toBe(404);
      const nonexistentJourneyNotFoundBody = await nonexistentJourneyReadResponse.json() as Record<string, unknown>;
      expect(nonexistentJourneyNotFoundBody).toMatchObject({ status: 404, code: 'NOT_FOUND', detail: 'The requested resource was not found' });
      expect(JSON.stringify(nonexistentJourneyNotFoundBody)).not.toContain(nonexistentJourneyId);
      const publicNotFoundShape = ({ type, title, status, code, detail }: Record<string, unknown>) => ({ type, title, status, code, detail });
      expect(publicNotFoundShape(foreignJourneyNotFoundBody)).toEqual(publicNotFoundShape(nonexistentJourneyNotFoundBody));

      const foreignFinishAction = {
        operationId: randomUUID(), kilometers: '12349.0', deviceAt: new Date(Date.now() + 500).toISOString(),
        observations: 'Foreign user must not finish this journey',
      };
      const journeyStateBeforeForeignFinish = await pool.query(
        `SELECT j.estado::text AS journey_state, j.observaciones_fin, j.updated_at AS journey_updated_at,
                mv.estado::text AS movement_state, mv.fecha_hora_fin, mv.lectura_fin_id::text AS final_reading_id,
                mv.updated_at AS movement_updated_at,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$2::uuid) AS operation_readings
         FROM gacor.jornadas j JOIN gacor.movimientos_vehiculo mv ON mv.id=j.movimiento_id
         WHERE j.id=$1::bigint`, [journeyId, foreignFinishAction.operationId],
      );
      expect(journeyStateBeforeForeignFinish.rowCount).toBe(1);
      const foreignFinishResponse = await fetch(`${baseUrl}/journeys/${journeyId}/finish`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${foreignAccessToken}` },
        body: JSON.stringify(foreignFinishAction),
      });
      expect(foreignFinishResponse.status).toBe(404);
      const journeyStateAfterForeignFinish = await pool.query(
        `SELECT j.estado::text AS journey_state, j.observaciones_fin, j.updated_at AS journey_updated_at,
                mv.estado::text AS movement_state, mv.fecha_hora_fin, mv.lectura_fin_id::text AS final_reading_id,
                mv.updated_at AS movement_updated_at,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$2::uuid) AS operation_readings
         FROM gacor.jornadas j JOIN gacor.movimientos_vehiculo mv ON mv.id=j.movimiento_id
         WHERE j.id=$1::bigint`, [journeyId, foreignFinishAction.operationId],
      );
      expect(journeyStateAfterForeignFinish.rows[0]).toEqual(journeyStateBeforeForeignFinish.rows[0]);
      expect(journeyStateAfterForeignFinish.rows[0]).toMatchObject({
        journey_state: 'ABIERTA', movement_state: 'ABIERTO', final_reading_id: null, operation_readings: '0',
      });

      const rejectedFinishAction = {
        operationId: randomUUID(), kilometers: '12344.9', deviceAt: new Date(Date.now() + 750).toISOString(),
        observations: 'Rejected odometer regression',
      };
      const journeyStateBeforeRejectedFinish = await pool.query(
        `SELECT j.estado::text AS journey_state, j.observaciones_fin, j.updated_at AS journey_updated_at,
                mv.estado::text AS movement_state, mv.fecha_hora_fin, mv.lectura_fin_id::text AS final_reading_id,
                mv.updated_at AS movement_updated_at,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$2::uuid) AS operation_readings,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE usuario_id=$3::bigint AND vehiculo_id=$4::bigint) AS odometer_count,
                (SELECT count(*)::text FROM gacor.cargas_combustible WHERE movimiento_id=mv.id) AS fuel_count,
                (SELECT count(*)::text FROM gacor.incidencias WHERE movimiento_id=mv.id) AS incident_count
         FROM gacor.jornadas j JOIN gacor.movimientos_vehiculo mv ON mv.id=j.movimiento_id
         WHERE j.id=$1::bigint`, [journeyId, rejectedFinishAction.operationId, userId, vehicleId],
      );
      const rejectedFinishResponse = await fetch(`${baseUrl}/journeys/${journeyId}/finish`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify(rejectedFinishAction),
      });
      expect(rejectedFinishResponse.status).toBe(409);
      const journeyStateAfterRejectedFinish = await pool.query(
        `SELECT j.estado::text AS journey_state, j.observaciones_fin, j.updated_at AS journey_updated_at,
                mv.estado::text AS movement_state, mv.fecha_hora_fin, mv.lectura_fin_id::text AS final_reading_id,
                mv.updated_at AS movement_updated_at,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$2::uuid) AS operation_readings,
                (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE usuario_id=$3::bigint AND vehiculo_id=$4::bigint) AS odometer_count,
                (SELECT count(*)::text FROM gacor.cargas_combustible WHERE movimiento_id=mv.id) AS fuel_count,
                (SELECT count(*)::text FROM gacor.incidencias WHERE movimiento_id=mv.id) AS incident_count
         FROM gacor.jornadas j JOIN gacor.movimientos_vehiculo mv ON mv.id=j.movimiento_id
         WHERE j.id=$1::bigint`, [journeyId, rejectedFinishAction.operationId, userId, vehicleId],
      );
      expect(journeyStateAfterRejectedFinish.rows[0]).toEqual(journeyStateBeforeRejectedFinish.rows[0]);
      expect(journeyStateAfterRejectedFinish.rows[0]).toMatchObject({
        journey_state: 'ABIERTA', movement_state: 'ABIERTO', final_reading_id: null, operation_readings: '0',
        odometer_count: '2', fuel_count: '1', incident_count: '2',
      });

      const finishAction = {
        operationId: randomUUID(), kilometers: '12350.0', deviceAt: new Date(Date.now() + 1_000).toISOString(),
        observations: 'Isolated HTTP E2E finish',
      };
      const journeyFinishResponse = await fetch(`${baseUrl}/journeys/${journeyId}/finish`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify(finishAction),
      });
      expect(journeyFinishResponse.status).toBe(200);
      expect(await journeyFinishResponse.json()).toMatchObject({
        id: journeyId, state: 'FINALIZADA', movement: { state: 'FINALIZADO' }, finalOdometer: { kilometers: '12350.0' },
      });
      const noOpenMovementAfterFinish = await fetch(`${baseUrl}/movements/me/assigned/open`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(noOpenMovementAfterFinish.status).toBe(404);
      expect(await noOpenMovementAfterFinish.json()).toMatchObject({ status: 404, code: 'NOT_FOUND' });

      const secondJourneyStartResponse = await fetch(`${baseUrl}/journeys/me`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({
          operationId: randomUUID(), kilometers: '12351.0', deviceAt: new Date(Date.now() + 2_000).toISOString(),
          observations: 'Isolated HTTP E2E second journey',
        }),
      });
      expect(secondJourneyStartResponse.status).toBe(201);
      const secondJourney = await secondJourneyStartResponse.json() as { id: string; state: string; movement: { id: string; startedAt: string } };
      secondJourneyId = secondJourney.id;
      expect(secondJourney).toMatchObject({ id: secondJourneyId, state: 'ABIERTA' });
      const secondJourneyFinishResponse = await fetch(`${baseUrl}/journeys/${secondJourneyId}/finish`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({
          operationId: randomUUID(), kilometers: '12352.0', deviceAt: new Date(Date.now() + 3_000).toISOString(),
          observations: 'Isolated HTTP E2E second finish',
        }),
      });
      expect(secondJourneyFinishResponse.status).toBe(200);
      expect(await secondJourneyFinishResponse.json()).toMatchObject({ id: secondJourneyId, state: 'FINALIZADA' });

      const openAdministrativeStartedAt = new Date();
      const openAdministrativeMovement = await pool.query<{ id: string }>(
        `INSERT INTO gacor.movimientos_vehiculo
           (vehiculo_id, usuario_id, tipo, estado, fecha_hora_inicio, motivo, uuid_operacion)
         VALUES ($1::bigint, $2::bigint, 'PRESTAMO_ADMINISTRATIVO'::gacor.tipo_movimiento_enum,
           'ABIERTO'::gacor.estado_movimiento_enum, $3::timestamptz,
           'Isolated HTTP open administrative movement fixture', $4::uuid)
         RETURNING id::text AS id`,
        [administrativeVehicleIds[0], administrativeUserId, openAdministrativeStartedAt, randomUUID()],
      );
      administrativeMovementIds.push(openAdministrativeMovement.rows[0]!.id);
      const openAdministrativeLoan = await pool.query<{ id: string }>(
        `INSERT INTO gacor.prestamos_administrativos
           (vehiculo_id, usuario_id, movimiento_id, fecha_hora_solicitud, fecha_hora_inicio_uso,
            destino, motivo, estado, uuid_operacion)
         VALUES ($1::bigint, $2::bigint, $3::bigint, $4::timestamptz, $4::timestamptz,
           'Integration fixture', 'HTTP read coverage', 'ACTIVO'::gacor.estado_prestamo_enum, $5::uuid)
         RETURNING id::text AS id`,
        [administrativeVehicleIds[0], administrativeUserId, openAdministrativeMovement.rows[0]!.id, openAdministrativeStartedAt, randomUUID()],
      );
      administrativeLoanIds.push(openAdministrativeLoan.rows[0]!.id);

      const ownAdministrativeOpenResponse = await fetch(`${baseUrl}/movements/me/administrative/open`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(ownAdministrativeOpenResponse.status).toBe(200);
      const ownAdministrativeOpen = await ownAdministrativeOpenResponse.json() as Record<string, unknown> & {
        id: string; vehicle: { id: string; plate: string }; type: string; state: string;
        startedAt: string; endedAt: string | null; journeyId: string | null; loanId: string;
        startOdometer: unknown; endOdometer: unknown;
      };
      expect(ownAdministrativeOpen).toMatchObject({
        id: openAdministrativeMovement.rows[0]!.id, vehicle: { id: administrativeVehicleIds[0] },
        type: 'PRESTAMO_ADMINISTRATIVO', state: 'ABIERTO', endedAt: null,
        journeyId: null, loanId: openAdministrativeLoan.rows[0]!.id,
        startOdometer: null, endOdometer: null,
      });
      expect(Date.parse(ownAdministrativeOpen.startedAt)).not.toBeNaN();
      expect(Object.keys(ownAdministrativeOpen).sort()).toEqual([
        'endOdometer', 'endedAt', 'id', 'journeyId', 'loanId', 'startOdometer', 'startedAt', 'state', 'type', 'vehicle',
      ]);

      const administrativeHistoryAfterOpenResponse = await fetch(`${baseUrl}/movements/me/administrative`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(administrativeHistoryAfterOpenResponse.status).toBe(200);
      const administrativeHistoryAfterOpen = await administrativeHistoryAfterOpenResponse.json() as {
        items: Array<{ id: string; type: string; state: string; journeyId: string | null; vehicle: { id: string } }>;
        hasMore: boolean; pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(administrativeHistoryAfterOpen.items.map(({ id }) => id)).toEqual([
        openAdministrativeMovement.rows[0]!.id, ownAdministrativeMovementTwoId, ownAdministrativeMovementOneId,
      ]);
      expect(administrativeHistoryAfterOpen.items.every(({ type, journeyId }) =>
        type === 'PRESTAMO_ADMINISTRATIVO' && journeyId === null)).toBe(true);
      expect(administrativeHistoryAfterOpen.items.some(({ id }) => id === foreignAdministrativeMovementId)).toBe(false);
      expect(administrativeHistoryAfterOpen.items.some(({ id }) => id === startedJourney.movement.id || id === secondJourney.movement.id)).toBe(false);

      const firstAdministrativePageResponse = await fetch(`${baseUrl}/movements/me/administrative?limit=1&offset=0`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(firstAdministrativePageResponse.status).toBe(200);
      expect(await firstAdministrativePageResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: openAdministrativeMovement.rows[0]!.id })], hasMore: true,
        pagination: { limit: 1, offset: 0, hasMore: true },
      });
      const secondAdministrativePageResponse = await fetch(`${baseUrl}/movements/me/administrative?limit=1&offset=1`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(secondAdministrativePageResponse.status).toBe(200);
      expect(await secondAdministrativePageResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: ownAdministrativeMovementTwoId })], hasMore: true,
        pagination: { limit: 1, offset: 1, hasMore: true },
      });
      const maximumAdministrativePageResponse = await fetch(`${baseUrl}/movements/me/administrative?limit=100`, {
        headers: { authorization: `Bearer ${administrativeAccessToken}` },
      });
      expect(maximumAdministrativePageResponse.status).toBe(200);
      expect(await maximumAdministrativePageResponse.json()).toMatchObject({
        items: [
          expect.objectContaining({ id: openAdministrativeMovement.rows[0]!.id }),
          expect.objectContaining({ id: ownAdministrativeMovementTwoId }),
          expect.objectContaining({ id: ownAdministrativeMovementOneId }),
        ], pagination: { limit: 100, offset: 0, hasMore: false },
      });

      const tiedStartTime = new Date(Date.now() - 60_000);
      const tiedMovementTimes = await pool.query<{ id: string }>(
        `UPDATE gacor.movimientos_vehiculo
         SET fecha_hora_inicio=$3::timestamptz
         WHERE id IN (
           SELECT movimiento_id FROM gacor.jornadas WHERE id=$1::bigint OR id=$2::bigint
         ) RETURNING id::text AS id`, [journeyId, secondJourneyId, tiedStartTime],
      );
      expect(tiedMovementTimes.rowCount).toBe(2);

      const ownAssignedMovementHistoryResponse = await fetch(`${baseUrl}/movements/me/assigned`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownAssignedMovementHistoryResponse.status).toBe(200);
      const ownAssignedMovementHistory = await ownAssignedMovementHistoryResponse.json() as {
        items: Array<{ id: string; journeyId: string; state: string; vehicle: { id: string }; startOdometer: { kilometers: string }; endOdometer: { kilometers: string } }>;
        hasMore: boolean; pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(ownAssignedMovementHistory.items.map(({ id }) => id)).toEqual([secondJourney.movement.id, startedJourney.movement.id]);
      expect(ownAssignedMovementHistory.items.map(({ journeyId: id }) => id)).toEqual([secondJourney.id, journeyId]);
      expect(ownAssignedMovementHistory.items.every(({ state, vehicle }) => state === 'FINALIZADO' && vehicle.id === vehicleId)).toBe(true);
      expect(ownAssignedMovementHistory.items.map(({ startOdometer, endOdometer }) => [startOdometer.kilometers, endOdometer.kilometers]))
        .toEqual([['12351.0', '12352.0'], ['12345.0', '12350.0']]);
      expect(ownAssignedMovementHistory).toMatchObject({
        hasMore: false, pagination: { limit: 25, offset: 0, hasMore: false },
      });

      const firstAssignedMovementPageResponse = await fetch(`${baseUrl}/movements/me/assigned?limit=1&offset=0`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(firstAssignedMovementPageResponse.status).toBe(200);
      expect(await firstAssignedMovementPageResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: secondJourney.movement.id })], hasMore: true,
        pagination: { limit: 1, offset: 0, hasMore: true },
      });
      const secondAssignedMovementPageResponse = await fetch(`${baseUrl}/movements/me/assigned?limit=1&offset=1`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(secondAssignedMovementPageResponse.status).toBe(200);
      expect(await secondAssignedMovementPageResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: startedJourney.movement.id })], hasMore: false,
        pagination: { limit: 1, offset: 1, hasMore: false },
      });
      const maximumAssignedMovementPageResponse = await fetch(`${baseUrl}/movements/me/assigned?limit=100`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(maximumAssignedMovementPageResponse.status).toBe(200);
      expect(await maximumAssignedMovementPageResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: secondJourney.movement.id }), expect.objectContaining({ id: startedJourney.movement.id })],
        pagination: { limit: 100, offset: 0, hasMore: false },
      });
      for (const query of ['limit=101', 'limit=0', 'offset=2147483648']) {
        const invalidAssignedMovementPageResponse = await fetch(`${baseUrl}/movements/me/assigned?${query}`, {
          headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        });
        expect(invalidAssignedMovementPageResponse.status, query).toBe(400);
        expect(await invalidAssignedMovementPageResponse.json()).toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
      }

      const ownJourneyHistoryResponse = await fetch(`${baseUrl}/journeys/me/history`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(ownJourneyHistoryResponse.status).toBe(200);
      const ownJourneyHistory = await ownJourneyHistoryResponse.json() as {
        items: Array<{ id: string; movement: { startedAt: string } }>;
        pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(Object.keys(ownJourneyHistory).sort()).toEqual(['items', 'pagination']);
      expect(ownJourneyHistory.pagination).toEqual({ limit: 25, offset: 0, hasMore: false });
      expect(ownJourneyHistory.items.map(({ id }) => id)).toEqual([secondJourneyId, journeyId]);
      for (const item of ownJourneyHistory.items) {
        expect(Object.keys(item).sort()).toEqual([
          'assignmentId', 'createdAt', 'endObservations', 'finalOdometer', 'id', 'initialOdometer',
          'movement', 'startObservations', 'state', 'vehicle',
        ]);
      }
      expect(Date.parse(ownJourneyHistory.items[0]!.movement.startedAt))
        .toBe(Date.parse(ownJourneyHistory.items[1]!.movement.startedAt));
      expect(BigInt(ownJourneyHistory.items[0]!.id)).toBeGreaterThan(BigInt(ownJourneyHistory.items[1]!.id));

      const foreignJourneyHistoryResponse = await fetch(`${baseUrl}/journeys/me/history`, {
        headers: { authorization: `Bearer ${foreignAccessToken}` },
      });
      expect(foreignJourneyHistoryResponse.status).toBe(200);
      const foreignJourneyHistory = await foreignJourneyHistoryResponse.json() as {
        items: Array<{ id: string; vehicle: { id: string } }>;
        pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(foreignJourneyHistory.items.map(({ id }) => id)).toEqual([foreignJourneyId]);
      expect(foreignJourneyHistory.items[0]!.vehicle.id).toBe(foreignVehicleId);
      expect(foreignJourneyHistory.items.some(({ id }) => id === journeyId || id === secondJourneyId)).toBe(false);

      const firstHistoryPageResponse = await fetch(`${baseUrl}/journeys/me/history?limit=1&offset=0`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(firstHistoryPageResponse.status).toBe(200);
      expect(await firstHistoryPageResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: secondJourneyId })], pagination: { limit: 1, offset: 0, hasMore: true },
      });
      const secondHistoryPageResponse = await fetch(`${baseUrl}/journeys/me/history?limit=1&offset=1`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(secondHistoryPageResponse.status).toBe(200);
      expect(await secondHistoryPageResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: journeyId })], pagination: { limit: 1, offset: 1, hasMore: false },
      });
      const invalidJourneyHistoryResponse = await fetch(`${baseUrl}/journeys/me/history?limit=0`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(invalidJourneyHistoryResponse.status).toBe(400);
      const maximumJourneyHistoryResponse = await fetch(`${baseUrl}/journeys/me/history?limit=100`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(maximumJourneyHistoryResponse.status).toBe(200);
      expect(await maximumJourneyHistoryResponse.json()).toMatchObject({
        items: [expect.objectContaining({ id: secondJourneyId }), expect.objectContaining({ id: journeyId })],
        pagination: { limit: 100, offset: 0, hasMore: false },
      });
      const excessiveJourneyHistoryLimitResponse = await fetch(`${baseUrl}/journeys/me/history?limit=101`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(excessiveJourneyHistoryLimitResponse.status).toBe(400);
      const excessiveJourneyHistoryOffsetResponse = await fetch(`${baseUrl}/journeys/me/history?offset=2147483648`, {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
      });
      expect(excessiveJourneyHistoryOffsetResponse.status).toBe(400);

      const endAssignment = await pool.query(
        `UPDATE gacor.asignaciones_vehiculo
         SET estado='FINALIZADA'::gacor.estado_asignacion_enum, fecha_hora_fin=NOW()
         WHERE id=$1::bigint AND estado='ACTIVA'::gacor.estado_asignacion_enum RETURNING id`, [assignmentId],
      );
      expect(endAssignment.rowCount).toBe(1);
      const noAssignmentOperationId = randomUUID();
      const noAssignmentStartResponse = await fetch(`${baseUrl}/journeys/me`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenPair.accessToken}` },
        body: JSON.stringify({
          operationId: noAssignmentOperationId, kilometers: '12353.0', deviceAt: new Date().toISOString(),
          observations: 'Rejected because no active assignment',
        }),
      });
      expect(noAssignmentStartResponse.status).toBe(404);
      const noAssignmentWrites = await pool.query<{ readings: string; movements: string; journeys: string }>(
        `SELECT
           (SELECT count(*)::text FROM gacor.lecturas_odometro WHERE uuid_operacion=$1::uuid) AS readings,
           (SELECT count(*)::text FROM gacor.movimientos_vehiculo WHERE uuid_operacion=$1::uuid) AS movements,
           (SELECT count(*)::text FROM gacor.jornadas WHERE uuid_operacion=$1::uuid) AS journeys`, [noAssignmentOperationId],
      );
      expect(noAssignmentWrites.rows[0]).toEqual({ readings: '0', movements: '0', journeys: '0' });

      const protectedResponse = await fetch(`${baseUrl}/cabinet`, { headers: { authorization: `Bearer ${tokenPair.accessToken}` } });
      expect(protectedResponse.status).toBe(403);

      const refreshResponse = await fetch(`${baseUrl}/auth/sessions/refresh`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: tokenPair.sessionId, refreshToken: tokenPair.refreshToken }),
      });
      expect(refreshResponse.status).toBe(200);
      const refreshed = await refreshResponse.json() as { accessToken: string; refreshToken: string; sessionId: string };
      expect(refreshed.sessionId).toBe(tokenPair.sessionId);
      const replayResponse = await fetch(`${baseUrl}/auth/sessions/refresh`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: tokenPair.sessionId, refreshToken: tokenPair.refreshToken }),
      });
      expect(replayResponse.status).toBe(401);

      const revokeResponse = await fetch(`${baseUrl}/auth/sessions/revoke`, {
        method: 'POST', headers: { authorization: `Bearer ${refreshed.accessToken}` },
      });
      expect(revokeResponse.status).toBe(204);
      const revokedAccessResponse = await fetch(`${baseUrl}/users/me`, {
        headers: { authorization: `Bearer ${refreshed.accessToken}` },
      });
      expect(revokedAccessResponse.status).toBe(401);

      const secondLoginResponse = await fetch(`${baseUrl}/auth/sessions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId, deviceToken }),
      });
      expect(secondLoginResponse.status).toBe(201);
      const secondTokenPair = await secondLoginResponse.json() as { accessToken: string; sessionId: string };
      const logoutResponse = await fetch(`${baseUrl}/auth/sessions/logout`, {
        method: 'POST', headers: { authorization: `Bearer ${secondTokenPair.accessToken}` },
      });
      expect(logoutResponse.status).toBe(204);
      const loggedOutAccessResponse = await fetch(`${baseUrl}/users/me`, {
        headers: { authorization: `Bearer ${secondTokenPair.accessToken}` },
      });
      expect(loggedOutAccessResponse.status).toBe(401);
    } finally {
      await application?.close();
      for (const loanId of administrativeLoanIds) {
        await pool.query('DELETE FROM gacor.prestamos_administrativos WHERE id=$1::bigint', [loanId]);
      }
      for (const movementId of administrativeMovementIds) {
        await pool.query('DELETE FROM gacor.movimientos_vehiculo WHERE id=$1::bigint', [movementId]);
      }
      for (const readingId of administrativeReadingIds) {
        await pool.query('DELETE FROM gacor.lecturas_odometro WHERE id=$1::bigint', [readingId]);
      }
      for (const positionId of administrativeAvailabilityPositionIds) {
        await pool.query('DELETE FROM gacor.posiciones_gabinete WHERE id=$1::bigint', [positionId]);
      }
      for (const keyringId of administrativeAvailabilityKeyringIds) {
        await pool.query('DELETE FROM gacor.llaveros WHERE id=$1::bigint', [keyringId]);
      }
      for (const cabinetId of administrativeAvailabilityCabinetIds) {
        await pool.query('DELETE FROM gacor.gabinetes WHERE id=$1::bigint', [cabinetId]);
      }
      for (const adminVehicleId of administrativeVehicleIds) {
        await pool.query('DELETE FROM gacor.vehiculos WHERE id=$1::bigint', [adminVehicleId]);
      }
      if (administrativeUserRoleApplied && administrativeUserId && administrativePilotRoleId) {
        await pool.query('DELETE FROM gacor.usuario_rol WHERE usuario_id=$1::bigint AND rol_id=$2::bigint', [administrativeUserId, administrativePilotRoleId]);
      }
      if (administrativeRolePermissionApplied && administrativePilotRoleId && administrativeVehiclePermissionId) {
        await pool.query('DELETE FROM gacor.rol_permiso WHERE rol_id=$1::bigint AND permiso_id=$2::bigint', [administrativePilotRoleId, administrativeVehiclePermissionId]);
      }
      if (pilotRolePermissionsApplied && pilotRoleId) {
        await pool.query(
          `DELETE FROM gacor.rol_permiso rp USING gacor.permisos p
           WHERE rp.permiso_id=p.id AND rp.rol_id=$1::bigint AND p.codigo = ANY($2::text[])`, [pilotRoleId, pilotPermissionCodes],
        );
      }
      if (userId && pilotRoleId) await pool.query('DELETE FROM gacor.usuario_rol WHERE usuario_id=$1::bigint AND rol_id=$2::bigint', [userId, pilotRoleId]);
      if (foreignUserId && pilotRoleId) await pool.query('DELETE FROM gacor.usuario_rol WHERE usuario_id=$1::bigint AND rol_id=$2::bigint', [foreignUserId, pilotRoleId]);
      if (fuelId) await pool.query('DELETE FROM gacor.cargas_combustible WHERE id=$1::bigint', [fuelId]);
      if (incidentId) await pool.query('DELETE FROM gacor.incidencias WHERE id=$1::bigint', [incidentId]);
      if (emergencyIncidentId) await pool.query('DELETE FROM gacor.incidencias WHERE id=$1::bigint', [emergencyIncidentId]);
      if (journeyId) await pool.query('DELETE FROM gacor.jornadas WHERE id=$1::bigint', [journeyId]);
      if (secondJourneyId) await pool.query('DELETE FROM gacor.jornadas WHERE id=$1::bigint', [secondJourneyId]);
      if (foreignJourneyId) await pool.query('DELETE FROM gacor.jornadas WHERE id=$1::bigint', [foreignJourneyId]);
      if (vehicleId && userId) {
        await pool.query('DELETE FROM gacor.movimientos_vehiculo WHERE vehiculo_id=$1::bigint AND usuario_id=$2::bigint', [vehicleId, userId]);
        await pool.query('DELETE FROM gacor.lecturas_odometro WHERE vehiculo_id=$1::bigint AND usuario_id=$2::bigint', [vehicleId, userId]);
      }
      if (foreignVehicleId && foreignUserId) {
        await pool.query('DELETE FROM gacor.movimientos_vehiculo WHERE vehiculo_id=$1::bigint AND usuario_id=$2::bigint', [foreignVehicleId, foreignUserId]);
        await pool.query('DELETE FROM gacor.lecturas_odometro WHERE vehiculo_id=$1::bigint AND usuario_id=$2::bigint', [foreignVehicleId, foreignUserId]);
      }
      if (assignmentId) await pool.query('DELETE FROM gacor.asignaciones_vehiculo WHERE id=$1::bigint', [assignmentId]);
      if (foreignAssignmentId) await pool.query('DELETE FROM gacor.asignaciones_vehiculo WHERE id=$1::bigint', [foreignAssignmentId]);
      if (userId) await pool.query('DELETE FROM gacor.bitacora WHERE usuario_id=$1::bigint', [userId]);
      if (vehicleId) await pool.query('DELETE FROM gacor.vehiculos WHERE id=$1::bigint', [vehicleId]);
      if (brigadeId) await pool.query('DELETE FROM gacor.brigadas WHERE id=$1::bigint', [brigadeId]);
      if (foreignVehicleId) await pool.query('DELETE FROM gacor.vehiculos WHERE id=$1::bigint', [foreignVehicleId]);
      if (foreignBrigadeId) await pool.query('DELETE FROM gacor.brigadas WHERE id=$1::bigint', [foreignBrigadeId]);
      if (deviceId) await pool.query('DELETE FROM gacor.dispositivos WHERE id=$1::bigint', [deviceId]);
      if (foreignDeviceId) await pool.query('DELETE FROM gacor.dispositivos WHERE id=$1::bigint', [foreignDeviceId]);
      if (administrativeDeviceId) await pool.query('DELETE FROM gacor.dispositivos WHERE id=$1::bigint', [administrativeDeviceId]);
      if (userId) await pool.query('DELETE FROM gacor.usuarios WHERE id=$1::bigint', [userId]);
      if (foreignUserId) await pool.query('DELETE FROM gacor.usuarios WHERE id=$1::bigint', [foreignUserId]);
      if (administrativeUserId) await pool.query('DELETE FROM gacor.usuarios WHERE id=$1::bigint', [administrativeUserId]);
      await removeFixtureAuditSince(auditBoundary);
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnvironment)) delete process.env[key];
      }
      for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }, 45_000);
});
