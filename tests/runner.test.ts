import path from 'path';
import { expect } from 'chai';
import { runPendingSeeders, runSeederByName, getSeederStatuses, resetSeeder } from '../src/runner';
import { PgSeederConfig } from '../src/types';
import { testAdapter } from './helpers/adapter';

// Resolve from project root: .js/.cjs fixtures aren't copied by tsc.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'tests', 'helpers', 'fixtures');

const config: Partial<PgSeederConfig> = {
  seedersPath: FIXTURES_DIR,
  tableName: 'seeders',
  adapter: testAdapter,
};

const SUCCESS = '20260101120000-test-success.seeder';
const FAIL = '20260101120001-test-fail.seeder';
const SECOND = '20260101120002-test-second-success.seeder';

describe('runner', function () {
  describe('runPendingSeeders', function () {
    it('should run all pending seeders', async function () {
      const results = await runPendingSeeders(config);
      expect(results).to.have.lengthOf(3);
      expect(results[0].name).to.equal(SUCCESS);
      expect(results[0].status).to.equal('success');
      expect(results[1].name).to.equal(FAIL);
      expect(results[1].status).to.equal('failed');
      expect(results[2].name).to.equal(SECOND);
      expect(results[2].status).to.equal('success');
    });

    it('should apply the effects of successful seeders', async function () {
      await runPendingSeeders(config);
      const rows = await testAdapter.query<{ name: string }>(
        'SELECT name FROM test_data ORDER BY name',
      );
      expect(rows.map((r) => r.name)).to.deep.equal(['test-second-success', 'test-success']);
    });

    it('should skip already executed seeders', async function () {
      await runPendingSeeders(config);
      const results = await runPendingSeeders(config);
      const skipped = results.filter((r) => r.status === 'skipped');
      // The two successful seeders are skipped, the failed one retries.
      expect(skipped).to.have.lengthOf(2);
      const failed = results.find((r) => r.status === 'failed');
      expect(failed).to.exist;
    });

    it('should record results in the tracking table', async function () {
      await runPendingSeeders(config);
      const records = await testAdapter.query('SELECT name FROM seeders');
      expect(records).to.have.lengthOf(3);
    });

    it('should execute seeders in sorted order', async function () {
      const results = await runPendingSeeders(config);
      const names = results.map((r) => r.name);
      const sorted = [...names].sort();
      expect(names).to.deep.equal(sorted);
    });
  });

  describe('runSeederByName', function () {
    it('should force-run a specific seeder', async function () {
      await runPendingSeeders(config);
      const results = await runSeederByName(SUCCESS, config);
      expect(results).to.have.lengthOf(1);
      expect(results[0].status).to.equal('success');
    });

    it('should throw if seeder not found', async function () {
      try {
        await runSeederByName('nonexistent-seeder', config);
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('not found');
      }
    });
  });

  describe('getSeederStatuses', function () {
    it('should return pending status for unexecuted seeders', async function () {
      const statuses = await getSeederStatuses(config);
      expect(statuses).to.have.lengthOf(3);
      statuses.forEach((s) => {
        expect(s.status).to.equal('pending');
        expect(s.executedAt).to.be.null;
      });
    });

    it('should return correct statuses after execution', async function () {
      await runPendingSeeders(config);
      const statuses = await getSeederStatuses(config);
      const success = statuses.filter((s) => s.status === 'success');
      const failed = statuses.filter((s) => s.status === 'failed');
      expect(success).to.have.lengthOf(2);
      expect(failed).to.have.lengthOf(1);
      expect(failed[0].error).to.include('Intentional seeder failure');
      expect(failed[0].executedAt).to.be.instanceOf(Date);
    });
  });

  describe('resetSeeder', function () {
    it('should allow a seeder to re-run after reset', async function () {
      await runPendingSeeders(config);
      await resetSeeder(SUCCESS, config);

      const statuses = await getSeederStatuses(config);
      const reset = statuses.find((s) => s.name === SUCCESS);
      expect(reset!.status).to.equal('pending');

      const results = await runPendingSeeders(config);
      const reran = results.find((r) => r.name === SUCCESS);
      expect(reran!.status).to.equal('success');
    });
  });

  describe('adapter requirement', function () {
    it('should throw when no adapter is provided', async function () {
      try {
        await runPendingSeeders({ seedersPath: FIXTURES_DIR });
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('adapter is required');
      }
    });
  });
});
