import { Global, Module } from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';
import { DatabaseEnvironment, validateEnvironment } from '../config/environment';
import { DATABASE_ENVIRONMENT, PG_POOL } from './database.constants';
import { DatabaseService } from './database.service';

export function buildPoolConfig(environment: DatabaseEnvironment): PoolConfig | undefined {
  const hasConnection = environment.connectionString !== undefined || environment.host !== undefined;
  if (!hasConnection) return undefined;

  const config: PoolConfig = environment.connectionString
    ? { connectionString: environment.connectionString }
    : {
        host: environment.host,
        port: environment.port,
        database: environment.database,
        user: environment.user,
        password: environment.password,
      };
  // Make our explicit policy authoritative over ambient PGSSLMODE values. For
  // DATABASE_URL, pg-connection-string still applies an allowed sslmode=verify-full.
  config.ssl = environment.sslMode === 'verify-full' ? { rejectUnauthorized: true } : false;
  config.application_name = 'dercas-api';
  config.options = '-c search_path=gacor,public';
  config.connectionTimeoutMillis = 5000;
  config.idleTimeoutMillis = 30000;
  config.max = 10;
  return config;
}

function createPool(): Pool | undefined {
  const config = buildPoolConfig(validateEnvironment(process.env).database);
  if (!config) return undefined;

  const pool = new Pool(config);
  pool.on('error', () => {
    // Driver error objects may contain connection details; never serialize them.
    process.stderr.write(`${JSON.stringify({ level: 'error', message: 'Idle PostgreSQL client error' })}\n`);
  });
  return pool;
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_ENVIRONMENT,
      useFactory: () => validateEnvironment(process.env).database,
    },
    { provide: PG_POOL, useFactory: createPool },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
