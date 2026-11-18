import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'dist',
    'data',
    'coverage',
    'playwright-report',
    'test-results',
    'node_modules',
    'scripts/_tmp',
    'scripts/scratch-serve.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['server/**', 'shared/**', 'scripts/**', 'e2e/**', '*.config.*'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**', 'e2e/**', 'server/index.ts', 'server/log.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // Keep explicit list semantics: Safari removes them from lists styled with list-style: none.
      'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'], nav: ['navigation'] }],
      // Scrollable regions must be focusable so keyboard users can scroll them.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'] }],
    },
  },
  {
    files: ['web/public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
]);
