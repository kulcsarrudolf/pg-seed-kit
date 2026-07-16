import { defineConfig } from 'tsup';

// Dual ESM + CJS build with type declarations. Each entry becomes its own
// chunk so importing the core never pulls in an ORM. Adapter and CLI entries
// are added in their respective PRs.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'adapters/typeorm': 'src/adapters/typeorm.ts',
    'adapters/sequelize': 'src/adapters/sequelize.ts',
    'adapters/prisma': 'src/adapters/prisma.ts',
    'adapters/drizzle': 'src/adapters/drizzle.ts',
  },
  // ORMs are optional peer dependencies: never bundle them into the adapters.
  external: ['typeorm', 'sequelize', '@prisma/client', 'drizzle-orm'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'node18',
});
