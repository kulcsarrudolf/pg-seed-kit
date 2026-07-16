import type { Adapter } from '../types';

/** The subset of a TypeORM `DataSource` this adapter relies on. */
export interface TypeOrmDataSourceLike {
  query(query: string, parameters?: unknown[]): Promise<unknown>;
  destroy(): Promise<unknown>;
}

/**
 * Build an {@link Adapter} from a TypeORM `DataSource`. Tracking SQL runs through
 * `dataSource.query`, which uses Postgres `$1` positional parameters.
 *
 * @example
 * import { typeormAdapter } from 'pg-seed-kit/typeorm';
 * const adapter = typeormAdapter(dataSource);
 */
export function typeormAdapter(dataSource: TypeOrmDataSourceLike): Adapter {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
      const rows = await dataSource.query(sql, params);
      return (rows ?? []) as T[];
    },
    async close(): Promise<void> {
      await dataSource.destroy();
    },
  };
}
