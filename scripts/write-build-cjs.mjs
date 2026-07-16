// The package is published as ESM ("type": "module"), but the test suite is
// compiled to CommonJS (see tests/tsconfig.json). Drop a package.json marker in
// the build output so Node treats the compiled .js files as CommonJS.
import { mkdirSync, writeFileSync } from 'fs';

mkdirSync('build', { recursive: true });
writeFileSync('build/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
