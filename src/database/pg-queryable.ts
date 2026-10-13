import { QueryResult, QueryResultRow } from 'pg';

export interface PgQueryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<R>>;
}
