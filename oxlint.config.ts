import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'import', 'promise', 'node', 'vitest'],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'error',
    pedantic: 'error',
  },
  options: {
    typeAware: true,
    denyWarnings: true,
    reportUnusedDisableDirectives: 'error',
  },
  rules: {
    'eslint/max-classes-per-file': 'off',
    'eslint/no-await-in-loop': 'off',
    'eslint/no-warning-comments': 'off',
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    'typescript/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
    'typescript/no-explicit-any': 'error',
    'typescript/no-import-type-side-effects': 'error',
    'typescript/prefer-readonly-parameter-types': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'unicorn/no-useless-undefined': 'off',
  },
  ignorePatterns: ['**/worker-configuration.d.ts', 'apps/server/openapi/turborepo.ts'],
  overrides: [
    {
      files: ['**/tests/**/*.ts'],
      rules: {
        'eslint/max-lines': 'off',
        'eslint/max-lines-per-function': 'off',
      },
    },
  ],
});
