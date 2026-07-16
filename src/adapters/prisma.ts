import type { Adapter } from '../types';

/** The subset of a Prisma client this adapter relies on. */
export interface PrismaClientLike {
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  $disconnect(): Promise<unknown>;
}

/**
 * Build an {@link Adapter} from a Prisma client. Prisma splits raw access into
 * two methods: `$queryRawUnsafe` returns rows (for `SELECT`), `$executeRawUnsafe`
 * returns an affected-row count (for `INSERT`/`DELETE`/DDL). We route by the
 * leading keyword so both read and write tracking statements work. Both use
 * Postgres `$1` positional parameters.
 *
 * @example
 * import { prismaAdapter } from 'pg-seed-kit/prisma';
 * const adapter = prismaAdapter(prisma);
 */
export function prismaAdapter(prisma: PrismaClientLike): Adapter {
  return {
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
      const values = params ?? [];
      if (/^\s*(select|with)\b/i.test(sql)) {
        const rows = await prisma.$queryRawUnsafe(sql, ...values);
        return (rows ?? []) as T[];
      }
      await prisma.$executeRawUnsafe(sql, ...values);
      return [] as T[];
    },
    async close(): Promise<void> {
      await prisma.$disconnect();
    },
  };
}
