import { expect } from 'chai';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { typeormAdapter } from '../src/adapters/typeorm';
import { sequelizeAdapter } from '../src/adapters/sequelize';
import { prismaAdapter } from '../src/adapters/prisma';
import { drizzleAdapter } from '../src/adapters/drizzle';
import {
  ensureTable,
  upsertSeederRecord,
  getExecutedSeeders,
  getAllTrackedSeeders,
} from '../src/tracker';

describe('adapters (unit, mocked clients)', function () {
  describe('typeormAdapter', function () {
    it('runs query via dataSource.query and closes via destroy', async function () {
      const calls: Array<{ sql: string; params?: unknown[] }> = [];
      let destroyed = false;
      const adapter = typeormAdapter({
        async query(sql: string, params?: unknown[]) {
          calls.push({ sql, params });
          return [{ n: 1 }];
        },
        async destroy() {
          destroyed = true;
        },
      });

      const rows = await adapter.query('SELECT 1 WHERE a = $1', [7]);
      expect(rows).to.deep.equal([{ n: 1 }]);
      expect(calls[0]).to.deep.equal({ sql: 'SELECT 1 WHERE a = $1', params: [7] });

      await adapter.close!();
      expect(destroyed).to.be.true;
    });
  });

  describe('sequelizeAdapter', function () {
    it('binds params, returns the rows tuple element, and closes', async function () {
      let captured: { sql: string; options: { bind?: unknown[] } } | null = null;
      let closed = false;
      const adapter = sequelizeAdapter({
        async query(sql: string, options: { bind?: unknown[] }) {
          captured = { sql, options };
          return [[{ n: 1 }], { rowCount: 1 }];
        },
        async close() {
          closed = true;
        },
      });

      const rows = await adapter.query('SELECT 1', [5]);
      expect(rows).to.deep.equal([{ n: 1 }]);
      expect(captured!.options).to.deep.equal({ bind: [5] });

      await adapter.close!();
      expect(closed).to.be.true;
    });
  });

  describe('prismaAdapter', function () {
    it('routes reads to $queryRawUnsafe and writes to $executeRawUnsafe', async function () {
      const reads: Array<{ sql: string; values: unknown[] }> = [];
      const writes: Array<{ sql: string; values: unknown[] }> = [];
      let disconnected = false;
      const adapter = prismaAdapter({
        async $queryRawUnsafe(sql: string, ...values: unknown[]) {
          reads.push({ sql, values });
          return [{ n: 1 }];
        },
        async $executeRawUnsafe(sql: string, ...values: unknown[]) {
          writes.push({ sql, values });
          return 1;
        },
        async $disconnect() {
          disconnected = true;
        },
      });

      const readRows = await adapter.query('SELECT * FROM seeders WHERE name = $1', ['a']);
      expect(readRows).to.deep.equal([{ n: 1 }]);
      expect(reads).to.have.lengthOf(1);
      expect(reads[0].values).to.deep.equal(['a']);

      const writeRows = await adapter.query('INSERT INTO seeders (name) VALUES ($1)', ['a']);
      expect(writeRows).to.deep.equal([]);
      expect(writes).to.have.lengthOf(1);
      expect(writes[0].values).to.deep.equal(['a']);

      await adapter.close!();
      expect(disconnected).to.be.true;
    });

    it('routes CREATE TABLE (DDL) to $executeRawUnsafe', async function () {
      let executed = false;
      const adapter = prismaAdapter({
        async $queryRawUnsafe() {
          throw new Error('should not be called for DDL');
        },
        async $executeRawUnsafe() {
          executed = true;
          return 0;
        },
        async $disconnect() {},
      });

      await adapter.query('CREATE TABLE IF NOT EXISTS seeders (name TEXT)');
      expect(executed).to.be.true;
    });
  });

  describe('drizzleAdapter', function () {
    it('extracts rows from a node-postgres style result', async function () {
      const adapter = drizzleAdapter({
        async execute() {
          return { rows: [{ n: 1 }] };
        },
      });
      expect(await adapter.query('SELECT 1')).to.deep.equal([{ n: 1 }]);
    });

    it('handles a driver that returns the rows array directly', async function () {
      const adapter = drizzleAdapter({
        async execute() {
          return [{ n: 2 }];
        },
      });
      expect(await adapter.query('SELECT 1')).to.deep.equal([{ n: 2 }]);
    });

    it('closes via the provided close option', async function () {
      let closed = false;
      const adapter = drizzleAdapter(
        {
          async execute() {
            return { rows: [] };
          },
        },
        { close: async () => void (closed = true) },
      );
      await adapter.close!();
      expect(closed).to.be.true;
    });
  });
});

describe('drizzleAdapter (integration, real drizzle + pg)', function () {
  it('runs tracking SQL with bound params against Postgres', async function () {
    const pool = (globalThis as { __TEST_POOL__?: Pool }).__TEST_POOL__!;
    const db = drizzle(pool);
    const adapter = drizzleAdapter(db);

    await ensureTable(adapter, 'seeders');
    await upsertSeederRecord(adapter, 'seeders', {
      name: 'dz',
      executedAt: new Date(),
      status: 'success',
    });

    const executed = await getExecutedSeeders(adapter, 'seeders');
    expect(executed.map((r) => r.name)).to.include('dz');

    // Params must be bound (not string-interpolated): values with quotes round-trip safely.
    await upsertSeederRecord(adapter, 'seeders', {
      name: "d'z",
      executedAt: new Date(),
      status: 'failed',
      error: "it's broken",
    });
    const all = await getAllTrackedSeeders(adapter, 'seeders');
    const record = all.find((r) => r.name === "d'z");
    expect(record?.error).to.equal("it's broken");
  });
});
