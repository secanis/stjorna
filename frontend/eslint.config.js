// ESLint flat config for the SolidJS frontend (`npm run lint`).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'public/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ...solid,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: false },
      globals: { ...globals.browser },
    },
    rules: {
      ...solid.rules,
      // Valuable but noisy on existing code; tighten incrementally.
      'solid/reactivity': 'warn',
      'solid/prefer-for': 'warn',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,ts}', 'tests/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      // Existing code leans on `any` for PocketBase error/record shapes;
      // tighten incrementally rather than in one sweep.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Bare `store.version;` reads are the idiomatic way to subscribe a
      // Solid effect to a signal, and `a() ? b() : c()` handlers are common.
      '@typescript-eslint/no-unused-expressions': [
        'warn',
        { allowShortCircuit: true, allowTernary: true },
      ],
    },
  },
);
