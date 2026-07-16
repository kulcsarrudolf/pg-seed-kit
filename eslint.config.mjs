import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'build/**', 'bin/**', 'docs/**', 'node_modules/**', 'tests/**/fixtures/**'],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      // This toolkit routinely handles arbitrary user records and errors, and
      // bridges several ORMs whose types are not always precise.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Chai assertions (e.g. `expect(x).to.be.an('array')`) are expression statements.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
