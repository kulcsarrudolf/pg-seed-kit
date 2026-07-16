import { loadConfig } from '../config';
import * as runner from '../runner';
import { Adapter, PgSeederConfig, SeederRunResult, SeederStatus } from '../types';
import { createSeeder } from './create';

export function printUsage(): void {
  console.log('Usage:');
  console.log('  pg-seed-kit create <name>   Create a new seeder file');
  console.log('  pg-seed-kit status          List seeders and statuses');
  console.log('  pg-seed-kit run [name]      Run pending seeders or one seeder');
  console.log('  pg-seed-kit reset <name>    Mark a seeder as pending');
  console.log('');
  console.log('Connection: your config must export an async connect() that returns an adapter.');
}

/**
 * Open a connection for a command that needs one. The config's `connect()`
 * initializes the ORM and returns an adapter; we pass it to the runner as an
 * override and close it when the command finishes.
 */
async function withAdapter<T>(
  action: (overrides: Partial<PgSeederConfig>) => Promise<T>,
): Promise<T> {
  const config = await loadConfig();
  if (!config.connect) {
    throw new Error(
      'pg-seed-kit: this command needs a database connection. ' +
        'Export an async connect() from your config that returns an adapter.',
    );
  }

  const adapter: Adapter = await config.connect();
  try {
    return await action({ adapter });
  } finally {
    await adapter.close?.();
  }
}

function printStatuses(statuses: SeederStatus[]): void {
  if (statuses.length === 0) {
    console.log('No seeders found.');
    return;
  }

  for (const status of statuses) {
    const executedAt = status.executedAt ? ` ${status.executedAt.toISOString()}` : '';
    const error = status.error ? ` - ${status.error}` : '';
    console.log(`${status.status.padEnd(7)} ${status.name}${executedAt}${error}`);
  }
}

function printRunResults(results: SeederRunResult[]): void {
  if (results.length === 0) {
    console.log('No seeders found.');
    return;
  }

  for (const result of results) {
    const error = result.error ? ` - ${result.error}` : '';
    console.log(`${result.status.padEnd(7)} ${result.name}${error}`);
  }
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<number> {
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return command ? 0 : 1;
  }

  try {
    switch (command) {
      case 'create': {
        const name = args[1];
        if (!name) {
          console.error('Error: seeder name is required.');
          console.error('Usage: pg-seed-kit create <name>');
          return 1;
        }
        await createSeeder(name);
        return 0;
      }

      case 'status': {
        await withAdapter(async (overrides) => {
          const statuses = await runner.getSeederStatuses(overrides);
          printStatuses(statuses);
        });
        return 0;
      }

      case 'run': {
        let results: SeederRunResult[] = [];
        const name = args[1];
        await withAdapter(async (overrides) => {
          results = name
            ? await runner.runSeederByName(name, overrides)
            : await runner.runPendingSeeders(overrides);
          printRunResults(results);
        });
        return results.some((result) => result.status === 'failed') ? 1 : 0;
      }

      case 'reset': {
        const name = args[1];
        if (!name) {
          console.error('Error: seeder name is required.');
          console.error('Usage: pg-seed-kit reset <name>');
          return 1;
        }
        await withAdapter(async (overrides) => {
          await runner.resetSeeder(name, overrides);
          console.log(`Reset: ${name}`);
        });
        return 0;
      }

      default:
        console.error(`Unknown command: "${command}"`);
        printUsage();
        return 1;
    }
  } catch (err: any) {
    console.error(err?.message || String(err));
    return 1;
  }
}
