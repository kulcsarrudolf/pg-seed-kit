import { expect } from 'chai';
import {
  ensureTable,
  getExecutedSeeders,
  getAllTrackedSeeders,
  upsertSeederRecord,
  deleteSeederRecord,
} from '../src/tracker';
import { testAdapter } from './helpers/adapter';

const TABLE = 'seeders';

describe('tracker', function () {
  beforeEach(async function () {
    await ensureTable(testAdapter, TABLE);
  });

  it('should create the tracking table', async function () {
    const rows = await testAdapter.query<{ exists: boolean }>(
      "SELECT to_regclass('public.seeders') IS NOT NULL AS exists",
    );
    expect(rows[0].exists).to.be.true;
  });

  it('should insert and read back a record', async function () {
    const executedAt = new Date();
    await upsertSeederRecord(testAdapter, TABLE, {
      name: 'a',
      executedAt,
      status: 'success',
    });

    const all = await getAllTrackedSeeders(testAdapter, TABLE);
    expect(all).to.have.lengthOf(1);
    expect(all[0].name).to.equal('a');
    expect(all[0].status).to.equal('success');
    expect(all[0].executedAt).to.be.instanceOf(Date);
  });

  it('should update an existing record on conflict', async function () {
    await upsertSeederRecord(testAdapter, TABLE, {
      name: 'a',
      executedAt: new Date(),
      status: 'success',
    });
    await upsertSeederRecord(testAdapter, TABLE, {
      name: 'a',
      executedAt: new Date(),
      status: 'failed',
      error: 'boom',
    });

    const all = await getAllTrackedSeeders(testAdapter, TABLE);
    expect(all).to.have.lengthOf(1);
    expect(all[0].status).to.equal('failed');
    expect(all[0].error).to.equal('boom');
  });

  it('should return only successful seeders from getExecutedSeeders', async function () {
    await upsertSeederRecord(testAdapter, TABLE, {
      name: 'ok',
      executedAt: new Date(),
      status: 'success',
    });
    await upsertSeederRecord(testAdapter, TABLE, {
      name: 'bad',
      executedAt: new Date(),
      status: 'failed',
      error: 'x',
    });

    const executed = await getExecutedSeeders(testAdapter, TABLE);
    expect(executed.map((r) => r.name)).to.deep.equal(['ok']);
  });

  it('should delete a record', async function () {
    await upsertSeederRecord(testAdapter, TABLE, {
      name: 'a',
      executedAt: new Date(),
      status: 'success',
    });
    await deleteSeederRecord(testAdapter, TABLE, 'a');
    const all = await getAllTrackedSeeders(testAdapter, TABLE);
    expect(all).to.have.lengthOf(0);
  });

  it('should reject invalid table names', async function () {
    try {
      await ensureTable(testAdapter, 'seeders; DROP TABLE users');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('invalid table name');
    }
  });
});
