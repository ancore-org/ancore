module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      diagnostics: false,
      isolatedModules: true,
    },
  },
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  testMatch: [
    '**/__tests__/initialize-smart-account.test.ts',
    '**/__tests__/builder.test.ts',
    '**/storage/__tests__/manager.test.ts',
  ],
  // Exclude integration tests from default run (use `pnpm test:integration`)
  testPathIgnorePatterns: ['/node_modules/', 'integration\\.test\\.ts$'],
};
