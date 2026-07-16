import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resetEnsuredTables } from '../../src/tracker';

let container: StartedPostgreSqlContainer;
let pool: Pool;

export const mochaHooks = {
  async beforeAll(this: Mocha.Context) {
    this.timeout(120000);
    container = await new PostgreSqlContainer('postgres:16').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    (globalThis as { __TEST_POOL__?: Pool }).__TEST_POOL__ = pool;

    // Table that fixture seeders write into, so tests can assert on their effects.
    await pool.query('CREATE TABLE IF NOT EXISTS test_data (id SERIAL PRIMARY KEY, name TEXT)');
  },

  async afterEach() {
    await pool.query('TRUNCATE test_data');
    await pool.query('DROP TABLE IF EXISTS seeders');
    resetEnsuredTables();
  },

  async afterAll() {
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  },
};
