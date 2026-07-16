import type { Adapter } from '../types';

/** The subset of a Sequelize instance this adapter relies on. */
export interface SequelizeLike {
  query(sql: string, options: { bind?: unknown[] }): Promise<unknown>;
  close(): Promise<unknown>;
}

/**
 * Build an {@link Adapter} from a Sequelize instance. Tracking SQL runs through
 * `sequelize.query` with `bind`, which uses Postgres `$1` positional parameters.
 * Sequelize resolves to a `[rows, metadata]` tuple; we return the rows.
 *
 * @example
 * import { sequelizeAdapter } from 'pg-seed-kit/sequelize';
 * const adapter = sequelizeAdapter(sequelize);
 */
export function sequelizeAdapter(sequelize: SequelizeLike): Adapter {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
      const result = await sequelize.query(sql, { bind: params });
      const rows = Array.isArray(result) ? result[0] : result;
      return (rows ?? []) as T[];
    },
    async close(): Promise<void> {
      await sequelize.close();
    },
  };
}
