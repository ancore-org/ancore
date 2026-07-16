const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const globals = require('globals');

const parserOptions = { ecmaVersion: 2020, sourceType: 'module' };

const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  process: 'readonly',
  TextEncoder: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'writable',
  global: 'readonly',
};

const jestGlobals = {
  describe: 'readonly',
  test: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
  jest: 'readonly',
};

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      // Browser + Node: PasskeyModule uses WebAuthn DOM APIs; rest of package is Node-friendly.
      globals: {
        ...globals.browser,
        ...globals.node,
        ...jestGlobals,
        ...nodeGlobals,
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TypeScript resolves symbols/types; no-undef false-positives on DOM lib types.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/__tests__/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions,
      globals: { ...globals.node, ...globals.jest, fail: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
