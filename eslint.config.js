import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'dist',
    'node_modules',
    'playwright-report',
    'coverage',
    'test-results',
    'design',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/domain must stay pure — no React.' },
            {
              name: 'react-dom',
              message: 'src/domain must stay pure — no React DOM.',
            },
            {
              name: 'react-dom/client',
              message: 'src/domain must stay pure — no React DOM.',
            },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*'],
              message: 'src/domain must stay pure — no React.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'src/domain must stay pure — no browser globals.',
        },
        {
          name: 'document',
          message: 'src/domain must stay pure — no browser globals.',
        },
        {
          name: 'localStorage',
          message: 'src/domain must stay pure — no browser globals.',
        },
        {
          name: 'sessionStorage',
          message: 'src/domain must stay pure — no browser globals.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            'src/domain must stay pure — inject a Clock instead of calling Date.now().',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            'src/domain must stay pure — inject a Clock instead of `new Date()`.',
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/state/**/*.{ts,tsx}', 'src/App.tsx'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Components must not touch localStorage directly — go through BoardRepository.',
        },
        {
          name: 'sessionStorage',
          message:
            'Components must not touch sessionStorage directly — go through BoardRepository.',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      // `!` is an accepted pattern in tests for asserting fixture invariants.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
]);
