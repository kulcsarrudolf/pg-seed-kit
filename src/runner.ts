import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { dynamicImport } from './dynamic-import';
import { loadConfig } from './config';
import {
  ensureTable,
  getExecutedSeeders,
  getAllTrackedSeeders,
  upsertSeederRecord,
  deleteSeederRecord,
} from './tracker';
import {
  Adapter,
  PgSeederConfig,
  ResolvedPgSeederConfig,
  SeederRunResult,
  SeederStatus,
  SeederRecord,
} from './types';

type SeederFn = () => Promise<void>;

function requireAdapter(config: ResolvedPgSeederConfig): Adapter {
  if (!config.adapter) {
    throw new Error(
      'pg-seed-kit: an adapter is required. Pass { adapter } to the runner, ' +
        'or expose one from your config (the CLI builds it via `connect`).',
    );
  }
  return config.adapter;
}

function getSeederFiles(config: ResolvedPgSeederConfig): string[] {
  if (!fs.existsSync(config.seedersPath)) {
    return [];
  }
  return fs
    .readdirSync(config.seedersPath)
    .filter((f) => config.filePattern.test(f))
    .sort();
}

async function loadSeeder(name: string, filepath: string): Promise<SeederFn> {
  // Dynamic import loads both ESM and CJS seeder files.
  const seederModule = await dynamicImport(pathToFileURL(filepath).href);
  const seederFn = seederModule.default ?? seederModule;

  if (typeof seederFn !== 'function') {
    throw new Error(`Seeder "${name}" does not export a function`);
  }
  return seederFn as SeederFn;
}

async function runSingleSeeder(
  adapter: Adapter,
  name: string,
  filepath: string,
  tableName: string,
  results: SeederRunResult[],
): Promise<void> {
  try {
    const seederFn = await loadSeeder(name, filepath);
    await seederFn();

    await upsertSeederRecord(adapter, tableName, {
      name,
      executedAt: new Date(),
      status: 'success',
    });

    results.push({ name, status: 'success' });
    console.log(`[pg-seed-kit] "${name}" ran successfully`);
  } catch (err: any) {
    const errorMessage = err?.message || String(err);

    await upsertSeederRecord(adapter, tableName, {
      name,
      executedAt: new Date(),
      status: 'failed',
      error: errorMessage,
    });

    results.push({ name, status: 'failed', error: errorMessage });
    console.error(`[pg-seed-kit] "${name}" failed: ${errorMessage}`);
  }
}

export async function runPendingSeeders(
  overrides?: Partial<PgSeederConfig>,
): Promise<SeederRunResult[]> {
  const config = await loadConfig(overrides);
  const adapter = requireAdapter(config);
  await ensureTable(adapter, config.tableName);

  const files = getSeederFiles(config);
  const executed = await getExecutedSeeders(adapter, config.tableName);
  const executedNames = new Set(executed.map((s) => s.name));

  const results: SeederRunResult[] = [];

  for (const file of files) {
    const name = path.basename(file, path.extname(file));

    if (executedNames.has(name)) {
      results.push({ name, status: 'skipped' });
      continue;
    }

    const filepath = path.join(config.seedersPath, file);
    await runSingleSeeder(adapter, name, filepath, config.tableName, results);
  }

  return results;
}

export async function runSeederByName(
  seederName: string,
  overrides?: Partial<PgSeederConfig>,
): Promise<SeederRunResult[]> {
  const config = await loadConfig(overrides);
  const adapter = requireAdapter(config);
  await ensureTable(adapter, config.tableName);

  const files = getSeederFiles(config);
  const file = files.find((f) => path.basename(f, path.extname(f)) === seederName);

  if (!file) {
    throw new Error(`Seeder "${seederName}" not found`);
  }

  const results: SeederRunResult[] = [];
  const filepath = path.join(config.seedersPath, file);
  await runSingleSeeder(adapter, seederName, filepath, config.tableName, results);
  return results;
}

export async function getSeederStatuses(
  overrides?: Partial<PgSeederConfig>,
): Promise<SeederStatus[]> {
  const config = await loadConfig(overrides);
  const adapter = requireAdapter(config);
  await ensureTable(adapter, config.tableName);

  const files = getSeederFiles(config);
  const tracked = await getAllTrackedSeeders(adapter, config.tableName);
  const trackedMap = new Map<string, SeederRecord>(tracked.map((s) => [s.name, s]));

  return files.map((f) => {
    const name = path.basename(f, path.extname(f));
    const record = trackedMap.get(name);
    return {
      name,
      status: (record?.status ?? 'pending') as 'success' | 'failed' | 'pending',
      executedAt: record?.executedAt ?? null,
      error: record?.error ?? null,
    };
  });
}

export async function resetSeeder(
  seederName: string,
  overrides?: Partial<PgSeederConfig>,
): Promise<void> {
  const config = await loadConfig(overrides);
  const adapter = requireAdapter(config);
  await ensureTable(adapter, config.tableName);
  await deleteSeederRecord(adapter, config.tableName, seederName);
}
