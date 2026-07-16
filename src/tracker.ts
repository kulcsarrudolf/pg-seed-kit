import { Adapter, SeederRecord } from './types';

/** Tables whose existence has already been ensured this process. */
let ensuredTables = new Set<string>();

interface TrackingRow {
  name: string;
  executed_at: Date;
  status: 'success' | 'failed';
  error: string | null;
}

/**
 * The tracking table name comes from user config, so it is interpolated into
 * SQL rather than bound as a parameter. Validate it as a plain identifier to
 * keep that interpolation safe.
 */
function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(
      `pg-seed-kit: invalid table name "${name}". ` +
        'Use only letters, digits, and underscores (must not start with a digit).',
    );
  }
  return `"${name}"`;
}

function toRecord(row: TrackingRow): SeederRecord {
  return {
    name: row.name,
    executedAt: row.executed_at,
    status: row.status,
    error: row.error ?? undefined,
  };
}

export async function ensureTable(adapter: Adapter, tableName: string): Promise<void> {
  if (ensuredTables.has(tableName)) return;
  const table = quoteIdentifier(tableName);
  await adapter.query(
    `CREATE TABLE IF NOT EXISTS ${table} (
       name TEXT PRIMARY KEY,
       executed_at TIMESTAMPTZ NOT NULL,
       status TEXT NOT NULL,
       error TEXT
     )`,
  );
  ensuredTables.add(tableName);
}

export async function getExecutedSeeders(
  adapter: Adapter,
  tableName: string,
): Promise<SeederRecord[]> {
  const table = quoteIdentifier(tableName);
  const rows = await adapter.query<TrackingRow>(
    `SELECT name, executed_at, status, error FROM ${table} WHERE status = 'success'`,
  );
  return rows.map(toRecord);
}

export async function getAllTrackedSeeders(
  adapter: Adapter,
  tableName: string,
): Promise<SeederRecord[]> {
  const table = quoteIdentifier(tableName);
  const rows = await adapter.query<TrackingRow>(
    `SELECT name, executed_at, status, error FROM ${table}`,
  );
  return rows.map(toRecord);
}

export async function upsertSeederRecord(
  adapter: Adapter,
  tableName: string,
  record: SeederRecord,
): Promise<void> {
  const table = quoteIdentifier(tableName);
  await adapter.query(
    `INSERT INTO ${table} (name, executed_at, status, error)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE
       SET executed_at = EXCLUDED.executed_at,
           status = EXCLUDED.status,
           error = EXCLUDED.error`,
    [record.name, record.executedAt, record.status, record.error ?? null],
  );
}

export async function deleteSeederRecord(
  adapter: Adapter,
  tableName: string,
  name: string,
): Promise<void> {
  const table = quoteIdentifier(tableName);
  await adapter.query(`DELETE FROM ${table} WHERE name = $1`, [name]);
}

/** Test hook: forget which tables have been ensured. */
export function resetEnsuredTables(): void {
  ensuredTables = new Set<string>();
}
