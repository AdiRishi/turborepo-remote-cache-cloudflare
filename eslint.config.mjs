import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import tsEslint from 'typescript-eslint';

/**
 * @type {import('eslint').Linter.FlatConfig[]}
 */
export default [
  js.configs.recommended,
  ...tsEslint.configs.recommendedTypeChecked,
  ...tsEslint.configs.stylisticTypeChecked,
  eslintPluginPrettier,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off',
    },
  },
  {
    files: ['docs/**/*.ts'],
    ...tsEslint.configs.disableTypeChecked,
  },
  {
    ignores: [
      '**/.eslintrc.json',
      '**/node_modules',
      '**/.nuxt',
      '**/.output',
      '**/.turbo',
      '**/assets',
      'functions/*.js',
      'functions/*.js.*',
      '**/public',
      '**/dist',
      '**/build',
      '**/coverage',
      '**/.wrangler',
      '**/.prettierrc.js',
    ],
  },
];
