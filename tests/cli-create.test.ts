import path from 'path';
import fs from 'fs';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSeeder } from '../src/cli/create';
import * as configModule from '../src/config';
import { ResolvedPgSeederConfig } from '../src/types';

const FILE_PATTERN = /^\d{14}-.+\.seeder\.(ts|js|mjs|cjs)$/;

function resolved(seedersPath: string): ResolvedPgSeederConfig {
  return { seedersPath, tableName: 'seeders', filePattern: FILE_PATTERN };
}

describe('cli create', function () {
  const tmpDir = path.join(__dirname, '.tmp-cli-create-test');

  beforeEach(function () {
    fs.mkdirSync(tmpDir, { recursive: true });
    sinon.stub(configModule, 'loadConfig').resolves(resolved(tmpDir));
  });

  afterEach(function () {
    sinon.restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a seeder file with the correct naming pattern', async function () {
    await createSeeder('user');
    const files = fs.readdirSync(tmpDir);
    expect(files).to.have.lengthOf(1);
    expect(files[0]).to.match(/^\d{14}-user\.seeder\.ts$/);
  });

  it('should contain the scaffold template', async function () {
    await createSeeder('test');
    const files = fs.readdirSync(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, files[0]), 'utf-8');
    expect(content).to.include('const seed = async ()');
    expect(content).to.include('export default seed');
    expect(content).to.include('TODO: implement');
  });

  it('should create the seeders directory if it does not exist', async function () {
    sinon.restore();
    const nestedDir = path.join(tmpDir, 'nested', 'seeders');
    sinon.stub(configModule, 'loadConfig').resolves(resolved(nestedDir));

    await createSeeder('deep');
    expect(fs.existsSync(nestedDir)).to.be.true;
    expect(fs.readdirSync(nestedDir)).to.have.lengthOf(1);
  });
});
