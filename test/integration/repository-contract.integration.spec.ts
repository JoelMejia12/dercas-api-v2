import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseEnvironment } from '../../src/config/environment';
import { SecureLogger } from '../../src/common/logging/secure-logger.service';
import { DatabaseService } from '../../src/database/database.service';
import { AuthRepository } from '../../src/auth/auth.repository';
import { UsersRepository } from '../../src/users/users.repository';
import { VehicleRepository } from '../../src/vehicles/vehicle.repository';
import { AssignmentRepository } from '../../src/assignments/assignment.repository';
import { LoanReadRepository } from '../../src/loans/loan-read.repository';
import { LoanRequestRepository } from '../../src/loans/loan-request.repository';
import { MovementsRepository } from '../../src/movements/movements.repository';
import { JourneysRepository } from '../../src/journeys/journeys.repository';
import { OdometerRepository } from '../../src/odometer/odometer.repository';
import { FuelRepository } from '../../src/fuel/fuel.repository';
import { MaintenanceRepository } from '../../src/maintenance/maintenance.repository';
import { IncidentsRepository } from '../../src/incidents/incidents.repository';
import { AlertsRepository } from '../../src/alerts/alerts.repository';
import { NotificationsRepository } from '../../src/notifications/notifications.repository';
import { CabinetRepository } from '../../src/cabinet/cabinet.repository';
import { GpsReadRepository } from '../../src/gps/gps-read.repository';

const explicitlyEnabled = process.env.RUN_PG_INTEGRATION === '1';
const page = { limit: 1, offset: 0 };

describe.skipIf(!explicitlyEnabled)('PostgreSQL repository read contracts (no DML)', () => {
  let pool: Pool;
  let database: DatabaseService;

  beforeAll(async () => {
    const target = integrationTarget();
    const { buildPoolConfig } = await import('../../src/database/database.module');
    const poolConfig = buildPoolConfig(target);
    if (!poolConfig) throw new Error('Integration pool configuration is unavailable');
    pool = new Pool({ ...poolConfig, max: 2, application_name: 'dercas-read-contract-tests' });
    database = new DatabaseService(pool, { error: () => undefined } as unknown as SecureLogger);

    const result = await pool.query<{ database_name: string; search_path: string; server_version_num: string }>(
      `SELECT current_database() AS database_name, current_setting('search_path') AS search_path,
              current_setting('server_version_num') AS server_version_num`,
    );
    expect(result.rows[0]?.database_name).toBe(target.database);
    expect(result.rows[0]?.search_path.replace(/\s+/g, '')).toBe('gacor,public');
    expect(Number(result.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(160000);
  }, 15_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('matches declarations in the official SQL file against installed PostgreSQL catalogs', async () => {
    const officialSql = readFileSync(resolve(process.cwd(), 'docs/GACOR_DERCAS_PostgreSQL_v3_GPS.sql'), 'utf8');
    const names = (pattern: RegExp): string[] => [...officialSql.matchAll(pattern)].map((match) => match[1]!);
    const uniqueNames = (items: string[]) => [...new Set(items)];
    const tables = uniqueNames(names(/^CREATE TABLE ([a-z_][a-z0-9_]*)\b/gim));
    const views = uniqueNames(names(/^CREATE OR REPLACE VIEW ([a-z_][a-z0-9_]*)\b/gim));
    const enums = uniqueNames(names(/^CREATE TYPE ([a-z_][a-z0-9_]*) AS ENUM\b/gim));
    const functions = uniqueNames(names(/^CREATE OR REPLACE FUNCTION ([a-z_][a-z0-9_]*)\s*\(/gim));
    const indexes = uniqueNames(names(/^CREATE INDEX ([a-z_][a-z0-9_]*)\s+ON\b/gim));
    const triggers = uniqueNames(names(/^CREATE TRIGGER ([a-z_][a-z0-9_]*)\b/gim));
    const constraints = uniqueNames(names(/^\s+CONSTRAINT ([a-z_][a-z0-9_]*)\b/gim));
    expect(tables.length).toBeGreaterThan(20);
    expect(views).toHaveLength(12);
    expect(enums).toHaveLength(26);
    expect(functions.length).toBeGreaterThan(10);
    expect(indexes.length).toBeGreaterThan(20);
    expect(triggers.length).toBeGreaterThan(10);
    // This source parser recognizes explicitly named table constraints only;
    // inline PRIMARY KEY/UNIQUE/REFERENCES clauses are not matched here.
    expect(constraints.length).toBeGreaterThan(0);

    const assertCatalogNames = async (requested: string[], query: string) => {
      const result = await pool.query<{ object_name: string; present: boolean }>(query, [requested]);
      expect(result.rows.filter((row) => !row.present).map((row) => row.object_name)).toEqual([]);
    };
    await assertCatalogNames(tables, `SELECT wanted.object_name,
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='gacor' AND c.relname=wanted.object_name AND c.relkind IN ('r','p')) AS present
      FROM unnest($1::text[]) AS wanted(object_name)`);
    await assertCatalogNames(views, `SELECT wanted.object_name,
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='gacor' AND c.relname=wanted.object_name AND c.relkind='v') AS present
      FROM unnest($1::text[]) AS wanted(object_name)`);
    await assertCatalogNames(enums, `SELECT wanted.object_name,
      EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
              WHERE n.nspname='gacor' AND t.typname=wanted.object_name AND t.typtype='e') AS present
      FROM unnest($1::text[]) AS wanted(object_name)`);
    await assertCatalogNames(functions, `SELECT wanted.object_name,
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='gacor' AND p.proname=wanted.object_name) AS present
      FROM unnest($1::text[]) AS wanted(object_name)`);
    await assertCatalogNames(indexes, `SELECT wanted.object_name,
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='gacor' AND c.relname=wanted.object_name AND c.relkind IN ('i','I')) AS present
      FROM unnest($1::text[]) AS wanted(object_name)`);
    await assertCatalogNames(triggers, `SELECT wanted.object_name,
      EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
              JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='gacor' AND t.tgname=wanted.object_name AND NOT t.tgisinternal) AS present
      FROM unnest($1::text[]) AS wanted(object_name)`);
    await assertCatalogNames(constraints, `SELECT wanted.object_name,
      EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
              WHERE n.nspname='gacor' AND c.conname=wanted.object_name) AS present
      FROM unnest($1::text[]) AS wanted(object_name)`);
  });

  it('executes authentication and user read queries against the official schema', async () => {
    const auth = new AuthRepository(database);
    const users = new UsersRepository(database);
    expect(await auth.findUser('absent-integration-user@example.invalid')).toBeUndefined();
    expect(await auth.findDevice('9223372036854775807')).toBeUndefined();
    expect(await auth.findActivePrincipal('9223372036854775807', '9223372036854775807', '9223372036854775807')).toBeUndefined();
    expect(await users.findProfile('9223372036854775807')).toBeNull();
    expect(await users.findAccess('9223372036854775807')).toBeNull();
    const listedUsers = await users.findUsers({ ...page, active: undefined, q: undefined });
    expect(Array.isArray(listedUsers.items)).toBe(true);
    expect(typeof listedUsers.hasMore).toBe('boolean');
    expect(await users.findUsers({ ...page, active: false, q: 'absent-integration-user' }))
      .toMatchObject({ items: [], hasMore: false });
    expect(await users.findUserById('9223372036854775807')).toBeNull();
  });

  it('executes vehicle, assignment, and loan read queries against the official schema', async () => {
    const vehicles = new VehicleRepository(database);
    const assignments = new AssignmentRepository(database);
    const loans = new LoanReadRepository(database);
    const requests = new LoanRequestRepository(database);
    expect(await vehicles.findSummaryById('1')).toBeNull();
    expect(await vehicles.findActiveAssignedToUser('1')).toBeNull();
    expect(await vehicles.findAdministrativeAvailable(page)).toMatchObject({ items: [], hasMore: false });
    expect(await vehicles.findAdministrativeAvailable({ ...page, cabinetId: '1' }))
      .toMatchObject({ items: [], hasMore: false });
    expect(await vehicles.findAdministrativeAvailableById('1')).toBeNull();
    expect(await vehicles.findAssignmentHistoryForUser('1')).toEqual([]);
    expect(await vehicles.findMaintenanceStatusForUser('1')).toEqual([]);
    expect(await assignments.findActiveForPilot('1')).toBeNull();
    expect(await assignments.findHistoryForPilot('1', 1, 0)).toMatchObject({ items: [], hasMore: false });
    expect(await assignments.findByIdForPilot('1', '1')).toBeNull();
    expect(await loans.findActiveForUser('1')).toEqual([]);
    expect(await loans.findHistoryForUser('1', page)).toEqual([]);
    expect(await loans.findAvailableAdministrativeVehicles(page)).toMatchObject({ items: [], hasMore: false });
    expect(await requests.findByIdForUser('1', '1')).toBeNull();
  });

  it('executes movement, journey, odometer, and fuel history queries against the official schema', async () => {
    const movements = new MovementsRepository(database);
    const journeys = new JourneysRepository(database);
    const odometer = new OdometerRepository(database);
    const fuel = new FuelRepository(database);
    expect(await movements.findHistory('1', 'assigned', page)).toMatchObject({ items: [], hasMore: false });
    expect(await movements.findHistory('1', 'administrative', page)).toMatchObject({ items: [], hasMore: false });
    expect(await movements.findOpen('1', 'assigned')).toBeNull();
    expect(await movements.findOpen('1', 'administrative')).toBeNull();
    expect(await movements.findById('1', '1', 'assigned')).toBeNull();
    expect(await journeys.findHistoryForUser('1', page)).toMatchObject({ items: [], hasMore: false });
    expect(await journeys.findByIdForUser('1', '1')).toBeNull();
    expect(await journeys.findCurrentForUser('1')).toBeNull();
    expect(await odometer.findHistoryForUser('1', page)).toMatchObject({ items: [], hasMore: false });
    expect(await odometer.findByIdForUser('1', '1')).toBeNull();
    expect(await fuel.findHistoryForUser('1', page)).toEqual([]);
    expect(await fuel.findByIdForUser('1', '1')).toBeNull();
  });

  it('executes maintenance, incident, alert, and notification read queries against the official schema', async () => {
    const maintenance = new MaintenanceRepository(database);
    const incidents = new IncidentsRepository(database);
    const alerts = new AlertsRepository(database);
    const notifications = new NotificationsRepository(database);
    expect(await maintenance.findOrdersForCurrentVehicle('1', { ...page, state: undefined })).toMatchObject({ items: [], hasMore: false });
    expect(await maintenance.findOrdersForCurrentVehicle('1', { ...page, state: 'CANCELADA' }))
      .toMatchObject({ items: [], hasMore: false });
    expect(await maintenance.findOrderByIdForCurrentVehicle('1', '1')).toBeNull();
    expect(await maintenance.findPlansForCurrentVehicle('1')).toEqual([]);
    expect(await maintenance.findAlertsForCurrentVehicle('1')).toEqual([]);
    expect(await incidents.findByIdForUser('1', '1')).toBeNull();
    expect(await incidents.findHistoryForUser('1', { ...page, type: undefined })).toMatchObject({ rows: [], hasMore: false });
    expect(await incidents.findHistoryForUser('1', { ...page, type: 'OTRO' }))
      .toMatchObject({ rows: [], hasMore: false });
    expect(await alerts.findForUser('1', false, page)).toMatchObject({ items: [], hasMore: false });
    expect(await alerts.findForUser('1', false, {
      ...page, alertState: 'PENDIENTE', notificationState: 'ENVIADA', channel: 'APP',
    })).toMatchObject({ items: [], hasMore: false });
    expect(await alerts.findByIdForUser('1', '1', false)).toBeNull();
    expect(await notifications.findForRecipient('1', page)).toMatchObject({ items: [], hasMore: false });
    expect(await notifications.findByIdForRecipient('1', '1')).toBeNull();
  });

  it('executes cabinet and GPS read queries against the official schema', async () => {
    const cabinet = new CabinetRepository(database);
    const gps = new GpsReadRepository(database);
    expect(await cabinet.findCabinets(page)).toMatchObject({ items: [], hasMore: false });
    expect(await cabinet.findPositions('1')).toBeNull();
    expect(await cabinet.findKeyrings(page)).toMatchObject({ items: [], hasMore: false });
    expect(await cabinet.findEvents(page)).toMatchObject({ items: [], hasMore: false });
    expect(await cabinet.findEvents({
      ...page, cabinetId: '1', positionId: '1', keyringId: '1', vehicleId: '1', userId: '1', loanId: '1',
      type: 'LECTURA', result: false,
    })).toMatchObject({ items: [], hasMore: false });
    expect(await gps.findMyLatest('1')).toBeNull();
    expect(await gps.findRealtimeMap(page)).toMatchObject({ items: [], hasMore: false });
    expect(await gps.findVehiclePositions('1', { ...page, from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' }))
      .toMatchObject({ items: [], hasMore: false });
    const managedDevices = await gps.findManagedDevices(page);
    expect(Array.isArray(managedDevices.items)).toBe(true);
    expect(typeof managedDevices.hasMore).toBe('boolean');
    expect(await gps.findManagedDevice('9223372036854775807')).toBeNull();
    expect(await gps.findMySessions('1', page)).toMatchObject({ items: [], hasMore: false });
    expect(await gps.findMySession('1', '1')).toBeNull();
    expect(await gps.findSessionPositions('1', '1', { ...page, from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' }))
      .toBeNull();
    expect(await gps.findOwnDeviceStatus('9223372036854775807')).toBeNull();
    expect(await gps.findGpsConfiguration()).not.toBeNull();
    expect(await gps.findProfiles(page)).toMatchObject({ items: [{ code: 'NORMAL' }], hasMore: true });
    expect(await gps.findArchives({ ...page, state: undefined })).toMatchObject({ items: [], hasMore: false });
    expect(await gps.findArchives({ ...page, state: 'GENERADO' })).toMatchObject({ items: [], hasMore: false });
    expect(await gps.findRetentionSummary()).not.toBeNull();
    expect(await gps.findMyRestorations('1', page)).toMatchObject({ items: [], hasMore: false });
    expect(await gps.findRestorationPositions('1', '1', { ...page, from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' }))
      .toBeNull();
  });
});

function integrationTarget(): DatabaseEnvironment & { readonly connectionString: string; readonly database: string } {
  if (process.env.NODE_ENV === 'production') throw new Error('Repository integration refuses NODE_ENV=production');
  const rawUrl = process.env.PG_INTEGRATION_DATABASE_URL;
  const database = process.env.PG_INTEGRATION_CONFIRM_DATABASE;
  const host = process.env.PG_INTEGRATION_CONFIRM_HOST;
  const port = Number(process.env.PG_INTEGRATION_CONFIRM_PORT);
  const sslMode = process.env.PG_INTEGRATION_SSL;
  if (!rawUrl || !database || !host || !Number.isInteger(port) || (sslMode !== 'disable' && sslMode !== 'verify-full')) {
    throw new Error('Repository integration requires an explicitly confirmed test target');
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Repository integration URL is invalid');
  }
  if ((url.protocol !== 'postgres:' && url.protocol !== 'postgresql:')
    || url.hostname !== host || Number(url.port || 5432) !== port
    || decodeURIComponent(url.pathname.slice(1)) !== database
    || !/(?:_test|_integration)$/i.test(database)
    || ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey'].some((key) => url.searchParams.has(key))) {
    throw new Error('Repository integration target does not match its explicit test confirmation');
  }
  if (process.env.PGDATABASE?.trim() === database) {
    throw new Error('Repository integration target matches the configured application database');
  }
  if (process.env.DATABASE_URL) {
    let applicationUrl: URL;
    try {
      applicationUrl = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error('Cannot verify repository integration separation from DATABASE_URL');
    }
    if (decodeURIComponent(applicationUrl.pathname.slice(1)) === database) {
      throw new Error('Repository integration target matches the configured application URL');
    }
  }
  return { connectionString: rawUrl, database, sslMode };
}
