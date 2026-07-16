// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * ESLint flat configuration for JeanScore 2.0.
 *
 * Uses the typescript-eslint **strict** rule set (Requirement 1.9) on top of
 * the recommended JavaScript rules, plus React Hooks and React Refresh rules
 * for the React 18 component layer. Lint failures block the production build
 * gate in CI (Requirement 1.9).
 */
export default tseslint.config(
  {
    // Generated artifacts and vendored code are not linted.
    ignores: ['dist', 'node_modules', 'js', 'google-apps-script', 'coverage'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Allow intentionally-unused bindings prefixed with `_` (e.g. omitted
      // destructured fields, ignored mock parameters), a common convention.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Node-context config files.
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
