/**
 * A dynamic import that is not rewritten to `require()` when this code is
 * transpiled to CommonJS. TypeScript (with `module: CommonJS`) and some bundlers
 * downlevel a literal `import()` into a `require()` call, which cannot load ESM
 * or `file://` URLs. Wrapping it in `new Function` preserves a native `import()`
 * at runtime, so both ESM and CJS seeder/config files load correctly from the
 * dual-format build.
 */
export const dynamicImport = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<Record<string, unknown>>;
