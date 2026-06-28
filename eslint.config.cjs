const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');

const builtinGlobals = {
  console: 'readonly',
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  process: 'readonly',
  module: 'readonly',
  require: 'readonly',
  Buffer: 'readonly',
  React: 'readonly',
  JSX: 'readonly',
};

module.exports = [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...builtinGlobals,
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
        vi: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TypeScript already resolves symbols and types; this rule causes false positives for DOM/lib types.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': ['warn'],
    },
  },
];
