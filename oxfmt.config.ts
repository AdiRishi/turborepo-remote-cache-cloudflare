import { defineConfig } from 'oxfmt';

export default defineConfig({
  singleQuote: true,
  sortImports: {
    groups: [
      'type-import',
      ['value-builtin', 'value-external'],
      'type-internal',
      'value-internal',
      ['type-parent', 'type-sibling', 'type-index'],
      ['value-parent', 'value-sibling', 'value-index'],
      'unknown',
    ],
  },
  sortPackageJson: {
    sortScripts: true,
  },
  ignorePatterns: [
    'pnpm-lock.yaml',
    '**/CHANGELOG.md',
    '**/worker-configuration.d.ts',
    'packages/spec/turborepo.*',
  ],
  overrides: [
    {
      // Nitro parses Wrangler config as strict JSONC, which rejects trailing commas.
      files: ['**/wrangler.jsonc'],
      options: { trailingComma: 'none' },
    },
  ],
});
