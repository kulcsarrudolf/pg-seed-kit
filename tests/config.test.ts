import path from 'path';
import fs from 'fs';
import { expect } from 'chai';
import { loadConfig, resolveSeedersPath } from '../src/config';

describe('config', function () {
  const tmpDir = path.join(__dirname, '.tmp-config-test');

  beforeEach(function () {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(function () {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should apply default tableName and filePattern', async function () {
    const config = await loadConfig({ seedersPath: './seeders' });
    expect(config.tableName).to.equal('seeders');
    expect(config.filePattern).to.be.instanceOf(RegExp);
  });

  it('should throw if seedersPath is missing', async function () {
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await loadConfig();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('seedersPath');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should resolve relative seedersPath to absolute', async function () {
    const config = await loadConfig({ seedersPath: './src/db/seeders' });
    expect(path.isAbsolute(config.seedersPath)).to.be.true;
  });

  it('should allow inline overrides to take precedence', async function () {
    const config = await loadConfig({
      seedersPath: './seeders',
      tableName: 'custom_seeders',
    });
    expect(config.tableName).to.equal('custom_seeders');
  });

  it('should resolve config from pg-seed-kit.config.cjs', async function () {
    const configFile = path.join(tmpDir, 'pg-seed-kit.config.cjs');
    fs.writeFileSync(configFile, 'module.exports = { seedersPath: "./my-seeders" };');

    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const config = await loadConfig();
      expect(config.seedersPath).to.include('my-seeders');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should resolve config from package.json', async function () {
    const pkgFile = path.join(tmpDir, 'package.json');
    fs.writeFileSync(
      pkgFile,
      JSON.stringify({ name: 'test', 'pg-seed-kit': { seedersPath: './pkg-seeders' } }),
    );

    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const config = await loadConfig();
      expect(config.seedersPath).to.include('pkg-seeders');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should accept seedersPath as a function and resolve lazily', async function () {
    let calls = 0;
    const config = await loadConfig({
      seedersPath: () => {
        calls += 1;
        return path.join(tmpDir, 'lazy-seeders');
      },
    });
    expect(calls).to.equal(1);
    expect(config.seedersPath).to.equal(path.join(tmpDir, 'lazy-seeders'));
  });

  it('should throw if seedersPath function returns empty', async function () {
    try {
      await loadConfig({ seedersPath: () => '' });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('non-empty string');
    }
  });

  describe('resolveSeedersPath', function () {
    it('should return src when srcWhen is true', function () {
      const resolver = resolveSeedersPath({
        src: '/app/src/seeders',
        dist: '/app/dist/seeders',
        srcWhen: () => true,
      });
      expect(resolver()).to.equal('/app/src/seeders');
    });

    it('should return dist by default in a plain node runtime', function () {
      const resolver = resolveSeedersPath({
        src: '/app/src/seeders',
        dist: '/app/dist/seeders',
        srcWhen: () => false,
      });
      expect(resolver()).to.equal('/app/dist/seeders');
    });
  });
});
