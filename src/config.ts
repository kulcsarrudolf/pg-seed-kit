import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { dynamicImport } from './dynamic-import';
import { PgSeederConfig, ResolvedPgSeederConfig, SeedersPathResolver } from './types';

const DEFAULT_TABLE_NAME = 'seeders';
const DEFAULT_FILE_PATTERN = /^\d{14}-.+\.seeder\.(ts|js|mjs|cjs)$/;

const CONFIG_FILES = ['pg-seed-kit.config.js', 'pg-seed-kit.config.cjs', 'pg-seed-kit.config.mjs'];

async function loadConfigFromFile(cwd: string): Promise<Partial<PgSeederConfig> | null> {
  for (const filename of CONFIG_FILES) {
    const filepath = path.resolve(cwd, filename);
    if (fs.existsSync(filepath)) {
      // Dynamic import handles both ESM and CJS config files.
      const loaded = await dynamicImport(pathToFileURL(filepath).href);
      return (loaded.default ?? loaded) as Partial<PgSeederConfig>;
    }
  }

  // package.json can carry only the static fields (not `connect`).
  const pkgPath = path.resolve(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg['pg-seed-kit']) {
      return pkg['pg-seed-kit'];
    }
  }

  return null;
}

function isResolver(value: string | SeedersPathResolver | undefined): value is SeedersPathResolver {
  return typeof value === 'function';
}

export async function loadConfig(
  overrides?: Partial<PgSeederConfig>,
): Promise<ResolvedPgSeederConfig> {
  const cwd = process.cwd();
  const fileConfig = await loadConfigFromFile(cwd);

  const merged = { ...fileConfig, ...overrides };

  if (!merged.seedersPath) {
    throw new Error(
      'pg-seed-kit: "seedersPath" is required. ' +
        'Provide it via pg-seed-kit.config.js, package.json, or inline config.',
    );
  }

  const rawPath = isResolver(merged.seedersPath) ? merged.seedersPath() : merged.seedersPath;

  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    throw new Error('pg-seed-kit: "seedersPath" must resolve to a non-empty string.');
  }

  const seedersPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);

  return {
    seedersPath,
    tableName: merged.tableName ?? DEFAULT_TABLE_NAME,
    filePattern: merged.filePattern ?? DEFAULT_FILE_PATTERN,
    adapter: merged.adapter,
    connect: merged.connect,
  };
}

/**
 * Pick between a `src/` and `dist/` seeders directory based on the current
 * runtime. Detection order:
 *
 * 1. If `srcWhen` returns `true`, use `src`.
 * 2. Otherwise, if the entrypoint script lives inside a `dist` directory
 *    (e.g. `node dist/...`), use `dist`.
 * 3. Otherwise, if the entrypoint ends with `.ts`/`.tsx` or is loaded via
 *    `tsx`/`ts-node`, use `src`.
 * 4. Fall back to `dist`.
 *
 * Keeping seeders in the same module graph as the app avoids duplicate entity
 * or model registration in TypeORM and Sequelize.
 *
 * @example
 * // pg-seed-kit.config.js
 * import path from 'path';
 * import { resolveSeedersPath } from 'pg-seed-kit';
 *
 * export default {
 *   seedersPath: resolveSeedersPath({
 *     src: path.join(process.cwd(), 'src/db/seeders'),
 *     dist: path.join(process.cwd(), 'dist/db/seeders'),
 *   }),
 * };
 */
export function resolveSeedersPath(opts: {
  src: string;
  dist: string;
  /** Optional override (e.g. read NODE_ENV). Returning `true` forces `src`. */
  srcWhen?: () => boolean;
}): SeedersPathResolver {
  return () => {
    if (opts.srcWhen && opts.srcWhen()) return opts.src;

    const argvFile = process.argv[1] || '';
    if (/[\\/]dist[\\/]/.test(argvFile)) return opts.dist;

    const isTsRuntime =
      /\.(ts|tsx)$/.test(argvFile) ||
      Boolean(
        (process as unknown as { _preload_modules?: string[] })._preload_modules?.some((m) =>
          /tsx|ts-node/.test(m),
        ),
      ) ||
      Boolean(process.env.TS_NODE_DEV) ||
      Boolean(process.env.TSX);
    return isTsRuntime ? opts.src : opts.dist;
  };
}
