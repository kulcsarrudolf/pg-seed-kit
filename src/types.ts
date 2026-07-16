/**
 * The single abstraction the core depends on. An adapter exposes one method,
 * `query`, that runs parameterized SQL (Postgres `$1`, `$2`, ... placeholders)
 * against a live connection and returns the result rows.
 *
 * pg-seed-kit ships no database driver of its own: adapters are built on top of
 * the connection your ORM already owns (see `pg-seed-kit/typeorm`,
 * `pg-seed-kit/prisma`, and friends). The adapter is used only for the library's
 * own tracking table; your seeders talk to the database through your ORM.
 */
export interface Adapter {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Optional teardown, invoked by the CLI after a standalone run. */
  close?(): Promise<void>;
}

/**
 * `seedersPath` may be a static string or a function evaluated lazily when a
 * runner is invoked. The function form lets consumers choose between a `src/`
 * tree (loaded by tsx/ts-node in development) and a `dist/` tree (loaded by
 * `node dist/...` in production), keeping seeders in the same module graph as
 * the rest of the app.
 */
export type SeedersPathResolver = () => string;

export interface PgSeederConfig {
  seedersPath: string | SeedersPathResolver;
  /** Table used to track seeder execution. Defaults to `seeders`. */
  tableName?: string;
  filePattern?: RegExp;
  /** A live adapter. Provide this when calling the API from your running app. */
  adapter?: Adapter;
  /**
   * Used by the CLI only: connects the ORM and returns an adapter. Lets the
   * standalone CLI open a connection in its own process, then close it.
   */
  connect?: () => Promise<Adapter>;
}

/** Internal shape after `loadConfig` has resolved any function form. */
export interface ResolvedPgSeederConfig {
  seedersPath: string;
  tableName: string;
  filePattern: RegExp;
  adapter?: Adapter;
  connect?: () => Promise<Adapter>;
}

export interface SeederRunResult {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

export interface SeederStatus {
  name: string;
  status: 'success' | 'failed' | 'pending';
  executedAt: Date | null;
  error: string | null;
}

export interface SeederRecord {
  name: string;
  executedAt: Date;
  status: 'success' | 'failed';
  error?: string;
}
