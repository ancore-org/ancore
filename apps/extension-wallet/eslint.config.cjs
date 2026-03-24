const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const globals = require('globals');

const languageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
};

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/**/*.js',
      'src/**/*.js.map',
      'src/**/*.d.ts',
      'src/**/*.d.ts.map',
      '*.config.js',
      '*.config.cjs',
      '*.config.ts',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ...languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ...languageOptions,
      parser: tsparser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
  },
];
