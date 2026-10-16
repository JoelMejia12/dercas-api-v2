export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';
export type PgSslMode = 'disable' | 'verify-full';

export interface DatabaseEnvironment {
  readonly connectionString?: string;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly user?: string;
  readonly password?: string;
  readonly sslMode: PgSslMode;
}

export interface Environment {
  readonly port: number;
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly logLevel: LogLevel;
  readonly database: DatabaseEnvironment;
}

const MIN_AUTH_TOKEN_SECRET_BYTES = 32;
const logLevels: readonly string[] = ['error', 'warn', 'info', 'debug', 'verbose'];
const nodeEnvironments: readonly string[] = ['development', 'test', 'production'];

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePort(value: string | undefined, name: string, fallback?: number): number | undefined {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid environment configuration: ${name} must be an integer from 1 to 65535`);
  }
  return parsed;
}

export function validateEnvironment(source: NodeJS.ProcessEnv): Environment {
  const authTokenSecret = source.AUTH_TOKEN_SECRET;
  if (!authTokenSecret || Buffer.byteLength(authTokenSecret, 'utf8') < MIN_AUTH_TOKEN_SECRET_BYTES) {
    throw new Error('Invalid environment configuration: AUTH_TOKEN_SECRET must be at least 32 bytes');
  }

  const port = parsePort(source.PORT, 'PORT', 3000);
  const nodeEnv = optionalString(source.NODE_ENV) ?? 'development';
  const logLevel = optionalString(source.LOG_LEVEL) ?? 'info';
  if (!nodeEnvironments.includes(nodeEnv)) {
    throw new Error('Invalid environment configuration: NODE_ENV is unsupported');
  }
  if (!logLevels.includes(logLevel)) {
    throw new Error('Invalid environment configuration: LOG_LEVEL is unsupported');
  }

  const connectionString = optionalString(source.DATABASE_URL);
  const host = optionalString(source.PGHOST);
  const database = optionalString(source.PGDATABASE);
  const user = optionalString(source.PGUSER);
  const password = source.PGPASSWORD === '' ? undefined : source.PGPASSWORD;
  const pgPort = parsePort(source.PGPORT, 'PGPORT');
  const hasDiscreteDatabaseSetting = [host, database, user, pgPort].some((value) => value !== undefined)
    || Boolean(password);

  if (connectionString && hasDiscreteDatabaseSetting) {
    throw new Error('Invalid environment configuration: use DATABASE_URL or PG* settings, not both');
  }
  if (hasDiscreteDatabaseSetting && (!host || !database || !user || password === undefined || password === '')) {
    throw new Error('Invalid environment configuration: PGHOST, PGDATABASE, PGUSER, and PGPASSWORD are required together');
  }

  if (connectionString) {
    try {
      const url = new URL(connectionString);
      if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error();
      if (!url.hostname || !url.pathname || url.pathname === '/') throw new Error();
      // pg-connection-string lets URL `ssl=no-verify` and `ssl=0` override PoolConfig.ssl.
      // Keep TLS policy in PGSSL; accepting those URL parameters could disable certificate checks.
      if (url.searchParams.has('ssl')) throw new Error();
      const urlSslMode = url.searchParams.get('sslmode');
      if (urlSslMode && urlSslMode !== 'verify-full') throw new Error();
    } catch {
      throw new Error('Invalid environment configuration: DATABASE_URL must be a valid PostgreSQL URL');
    }
  }

  const sslMode = optionalString(source.PGSSL) ?? 'disable';
  if (sslMode !== 'disable' && sslMode !== 'verify-full') {
    throw new Error('Invalid environment configuration: PGSSL must be disable or verify-full');
  }
  if (nodeEnv === 'production' && (connectionString || hasDiscreteDatabaseSetting) && sslMode !== 'verify-full') {
    throw new Error('Invalid environment configuration: PGSSL=verify-full is required for PostgreSQL in production');
  }
  return {
    port: port!,
    nodeEnv: nodeEnv as Environment['nodeEnv'],
    logLevel: logLevel as LogLevel,
    database: {
      connectionString,
      host,
      port: pgPort,
      database,
      user,
      password,
      sslMode: sslMode as PgSslMode,
    },
  };
}
