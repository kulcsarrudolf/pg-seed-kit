import { sql, type SQL } from 'drizzle-orm';
import type { Adapter } from '../types';

/** The subset of a Drizzle database this adapter relies on. */
export interface DrizzleLike {
  execute(query: SQL): Promise<unknown>;
}

/**
 * Convert a Postgres statement with `$1` placeholders and a positional params
 * array into a Drizzle `SQL` object, binding each `$n` to `params[n - 1]`.
 */
function toDrizzleSql(text: string, params: unknown[]): SQL {
  const chunks: SQL[] = [];
  const placeholder = /\$(\d+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = placeholder.exec(text)) !== null) {
    chunks.push(sql.raw(text.slice(lastIndex, match.index)));
    chunks.push(sql`${params[Number(match[1]) - 1]}`);
    lastIndex = placeholder.lastIndex;
  }
  chunks.push(sql.raw(text.slice(lastIndex)));
  return sql.join(chunks);
}

/**
 * Build an {@link Adapter} from a Drizzle database. Tracking SQL is bound through
 * Drizzle's `sql` template and run with `db.execute`. Because closing the
 * connection is driver-specific (the pool lives outside the Drizzle instance),
 * pass `close` to end it from the CLI.
 *
 * Targets the `drizzle-orm/node-postgres` driver (result exposes `rows`);
 * postgres-js returns the rows array directly, which is handled too.
 *
 * @example
 * import { drizzleAdapter } from 'pg-seed-kit/drizzle';
 * const adapter = drizzleAdapter(db, { close: () => pool.end() });
 */
export function drizzleAdapter(
  db: DrizzleLike,
  options?: { close?: () => Promise<void> },
): Adapter {
  return {
    async query<T = unknown>(sqlText: string, params?: unknown[]): Promise<T[]> {
      const result = await db.execute(toDrizzleSql(sqlText, params ?? []));
      const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows;
      return (rows ?? []) as T[];
    },
    close: options?.close,
  };
}
