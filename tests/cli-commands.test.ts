import { expect } from 'chai';
import sinon from 'sinon';
import { runCli } from '../src/cli/commands';
import * as configModule from '../src/config';
import * as runner from '../src/runner';
import { Adapter, ResolvedPgSeederConfig } from '../src/types';

const FILE_PATTERN = /^\d{14}-.+\.seeder\.(ts|js|mjs|cjs)$/;

describe('cli commands', function () {
  let connectStub: sinon.SinonStub;
  let closeStub: sinon.SinonStub;
  let logStub: sinon.SinonStub;
  let errorStub: sinon.SinonStub;

  function stubConfig(connect?: () => Promise<Adapter>): void {
    const config: ResolvedPgSeederConfig = {
      seedersPath: '/seeders',
      tableName: 'seeders',
      filePattern: FILE_PATTERN,
      connect,
    };
    sinon.stub(configModule, 'loadConfig').resolves(config);
  }

  beforeEach(function () {
    closeStub = sinon.stub().resolves();
    connectStub = sinon.stub().resolves({
      query: sinon.stub().resolves([]),
      close: closeStub,
    } as Adapter);
    stubConfig(connectStub);
    logStub = sinon.stub(console, 'log');
    errorStub = sinon.stub(console, 'error');
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should print seeder statuses', async function () {
    sinon.stub(runner, 'getSeederStatuses').resolves([
      {
        name: '20260101120000-user.seeder',
        status: 'success',
        executedAt: new Date('2026-01-01T12:00:00.000Z'),
        error: null,
      },
      { name: '20260101120001-role.seeder', status: 'pending', executedAt: null, error: null },
    ]);

    const exitCode = await runCli(['status']);

    expect(exitCode).to.equal(0);
    expect(connectStub.calledOnce).to.be.true;
    expect(closeStub.calledOnce).to.be.true;
    expect(logStub.calledWithMatch('success')).to.be.true;
    expect(logStub.calledWithMatch('pending')).to.be.true;
  });

  it('should run pending seeders', async function () {
    sinon.stub(runner, 'runPendingSeeders').resolves([
      { name: '20260101120000-user.seeder', status: 'success' },
      { name: '20260101120001-role.seeder', status: 'skipped' },
    ]);

    const exitCode = await runCli(['run']);

    expect(exitCode).to.equal(0);
    expect(connectStub.calledOnce).to.be.true;
    expect(closeStub.calledOnce).to.be.true;
    expect(logStub.calledWithMatch('success')).to.be.true;
    expect(logStub.calledWithMatch('skipped')).to.be.true;
  });

  it('should run one seeder by name', async function () {
    const runByNameStub = sinon
      .stub(runner, 'runSeederByName')
      .resolves([{ name: '20260101120000-user.seeder', status: 'success' }]);

    const exitCode = await runCli(['run', '20260101120000-user.seeder']);

    expect(exitCode).to.equal(0);
    expect(runByNameStub.calledWith('20260101120000-user.seeder')).to.be.true;
  });

  it('should exit with failure when a seeder fails', async function () {
    sinon
      .stub(runner, 'runPendingSeeders')
      .resolves([{ name: '20260101120000-user.seeder', status: 'failed', error: 'boom' }]);

    const exitCode = await runCli(['run']);

    expect(exitCode).to.equal(1);
    expect(logStub.calledWithMatch('boom')).to.be.true;
    expect(closeStub.calledOnce).to.be.true;
  });

  it('should reset a seeder', async function () {
    const resetStub = sinon.stub(runner, 'resetSeeder').resolves();

    const exitCode = await runCli(['reset', '20260101120000-user.seeder']);

    expect(exitCode).to.equal(0);
    expect(resetStub.calledWith('20260101120000-user.seeder')).to.be.true;
    expect(logStub.calledWith('Reset: 20260101120000-user.seeder')).to.be.true;
  });

  it('should fail when the config has no connect()', async function () {
    sinon.restore();
    stubConfig(undefined);
    logStub = sinon.stub(console, 'log');
    errorStub = sinon.stub(console, 'error');

    const exitCode = await runCli(['status']);

    expect(exitCode).to.equal(1);
    expect(errorStub.calledWithMatch('connect()')).to.be.true;
  });

  it('should print usage and exit non-zero with no command', async function () {
    const exitCode = await runCli([]);
    expect(exitCode).to.equal(1);
    expect(logStub.calledWithMatch('Usage:')).to.be.true;
  });
});
