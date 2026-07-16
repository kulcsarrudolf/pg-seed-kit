import { defineConfig } from 'tsup';

// Dual ESM + CJS build with type declarations. Each entry becomes its own
// chunk so importing the core never pulls in an ORM. Adapter and CLI entries
// are added in their respective PRs.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  target: 'node18',
});
