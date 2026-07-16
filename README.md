# pg-seed-kit

[![npm version](https://img.shields.io/npm/v/pg-seed-kit)](https://www.npmjs.com/package/pg-seed-kit)
[![license](https://badgen.net/npm/license/pg-seed-kit)](https://github.com/kulcsarrudolf/pg-seed-kit/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dt/pg-seed-kit)](https://www.npmjs.com/package/pg-seed-kit)
[![GitHub Stars](https://badgen.net/github/stars/kulcsarrudolf/pg-seed-kit)](https://github.com/kulcsarrudolf/pg-seed-kit)

A lightweight, zero-dependency seeder toolkit for Postgres that works with **Prisma**, **Drizzle**, **TypeORM**, and **Sequelize**. Run one-time seed scripts on startup, track execution status, and manage seeders via a small CLI.

The package ships **no runtime dependencies**: instead of opening its own connection, it runs its tracking SQL through a tiny adapter built on the connection your ORM already owns.

> Docs with copy-paste examples for every ORM: **https://kulcsarrudolf.github.io/pg-seed-kit/**

## Installation

```bash
npm install pg-seed-kit
```

Your ORM is an optional peer dependency: install whichever one you already use (`@prisma/client`, `drizzle-orm`, `typeorm`, or `sequelize`).

## Quick Start (Prisma)

Point pg-seed-kit at your seeders and tell it how to connect. Create `pg-seed-kit.config.js`:

```javascript
import { prismaAdapter } from "pg-seed-kit/prisma";
import { prisma } from "./db.js"; // your shared PrismaClient

export default {
  seedersPath: "./prisma/seeders",
  connect: async () => prismaAdapter(prisma),
};
```

Scaffold a seeder:

```bash
npx pg-seed-kit create add-admin
```

Implement the generated `prisma/seeders/20260320120000-add-admin.seeder.ts`:

```typescript
import { prisma } from "../../db.js";

const seed = async (): Promise<void> => {
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", role: "admin" },
  });
};

export default seed;
```

Run pending seeders, either from your app (after the ORM is connected) or via the CLI:

```typescript
import { runPendingSeeders } from "pg-seed-kit";
import { prismaAdapter } from "pg-seed-kit/prisma";
import { prisma } from "./db.js";

await runPendingSeeders({ adapter: prismaAdapter(prisma) });
```

```bash
npx pg-seed-kit run
```

Using **Drizzle**, **TypeORM**, or **Sequelize**? The same three steps, with that ORM's adapter and idiom: see the [website](https://kulcsarrudolf.github.io/pg-seed-kit/).

## How It Works

1. Seeder files are sorted alphabetically; the timestamp prefix (`20260320120000-`) keeps them in chronological order.
2. On each run, only seeders without a `success` record in the tracking table are executed. The table (`seeders` by default) is auto-created on first run.
3. If a seeder fails it is recorded as `failed` and retried on the next run; execution continues with the remaining seeders.

## API

All functions take an options object with a live `adapter` and assume your ORM is already connected.

| Function                         | Description                                        | Returns             |
| -------------------------------- | -------------------------------------------------- | ------------------- |
| `runPendingSeeders(options?)`    | Runs seeders without a successful tracking record  | `SeederRunResult[]` |
| `runSeederByName(name, options?)`| Force-runs one seeder, even if already executed    | `SeederRunResult[]` |
| `getSeederStatuses(options?)`    | Lists `pending`, `success`, and `failed` seeders   | `SeederStatus[]`    |
| `resetSeeder(name, options?)`    | Deletes the tracking record so a seeder can rerun  | `Promise<void>`     |

## Adapters

Import an adapter from its subpath and build it from your ORM's connection.

| ORM       | Import                   | Factory                                  |
| --------- | ------------------------ | ---------------------------------------- |
| Prisma    | `pg-seed-kit/prisma`     | `prismaAdapter(prisma)`                  |
| Drizzle   | `pg-seed-kit/drizzle`    | `drizzleAdapter(db, { close? })`         |
| TypeORM   | `pg-seed-kit/typeorm`    | `typeormAdapter(dataSource)`             |
| Sequelize | `pg-seed-kit/sequelize`  | `sequelizeAdapter(sequelize)`            |

## Config

Config is loaded from `pg-seed-kit.config.js` (or `.cjs`/`.mjs`), the `"pg-seed-kit"` key in `package.json`, or inline options.

| Option        | Type                       | Default        | Description                                          |
| ------------- | -------------------------- | -------------- | ---------------------------------------------------- |
| `seedersPath` | `string \| () => string`   | (required)     | Directory containing seeder files                    |
| `tableName`   | `string`                   | `"seeders"`    | Table used to track execution                        |
| `filePattern` | `RegExp`                   | `/^\d{14}-.+\.seeder\.(ts\|js\|mjs\|cjs)$/` | Pattern that matches seeder files    |
| `adapter`     | `Adapter`                  | (none)         | A live adapter, for calling the API from your app    |
| `connect`     | `() => Promise<Adapter>`   | (none)         | Used by the CLI to open a connection and adapter     |

## CLI

```bash
npx pg-seed-kit create <name>    # Scaffold a new seeder file
npx pg-seed-kit status           # List seeders and statuses
npx pg-seed-kit run              # Run all pending seeders
npx pg-seed-kit run <name>       # Force-run one seeder by name
npx pg-seed-kit reset <name>     # Mark a seeder as pending
```

`status`, `run`, and `reset` use your config's async `connect()` to open a connection, then close it when done. `run` exits non-zero if any seeder fails.

## Contributing

Submit a pull request or open an issue on GitHub.

## License

MIT
