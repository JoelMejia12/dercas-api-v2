import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { SecureLogger } from '../common/logging/secure-logger.service';
import { PG_POOL } from './database.constants';
import { PgQueryable } from './pg-queryable';

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('Database connection is not configured');
    this.name = 'DatabaseNotConfiguredError';
  }
}

export interface DatabaseAuditContext {
  readonly userId: string;
  readonly ip: string;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool | undefined,
    private readonly logger: SecureLogger,
  ) {}

  get isConfigured(): boolean {
    return this.pool !== undefined;
  }

  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<R>> {
    if (!this.pool) throw new DatabaseNotConfiguredError();
    return this.pool.query<R>(text, [...values]);
  }

  async transaction<T>(
    work: (queryable: PgQueryable) => Promise<T>,
    auditContext?: DatabaseAuditContext,
  ): Promise<T> {
    const client = await this.getClient();
    let destroyClient: Error | boolean | undefined;
    try {
      await client.query('BEGIN');
      if (auditContext) {
        await client.query(
          `SELECT set_config('app.user_id', $1::bigint::text, true),
                  set_config('app.ip', $2::inet::text, true)`,
          [auditContext.userId, auditContext.ip],
        );
      }
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.logger.error('Database transaction rollback failed');
        destroyClient = rollbackError instanceof Error ? rollbackError : true;
      }
      throw error;
    } finally {
      if (destroyClient === undefined) client.release();
      else client.release(destroyClient);
    }
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.pool) return false;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  private async getClient(): Promise<PoolClient> {
    if (!this.pool) throw new DatabaseNotConfiguredError();
    return this.pool.connect();
  }
}
