import type { Pool } from 'pg';
import { Adapter } from '../../src/types';

/**
 * A `pg`-backed adapter used by the test suite to exercise the tracker and
 * runner against a real Postgres instance. It reads the pool set up by the
 * Testcontainers root hook (see setup.ts) lazily, so it can be constructed at
 * module load time before the container has started.
 */
export const testAdapter: Adapter = {
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const pool = (globalThis as { __TEST_POOL__?: Pool }).__TEST_POOL__;
    if (!pool) {
      throw new Error('Test pool is not initialized');
    }
    const result = await pool.query(sql, params as unknown[] | undefined);
    return result.rows as T[];
  },
};
