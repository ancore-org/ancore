/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // `turbo run test` runs every package concurrently, and jest's default
  // maxWorkers (CPU-count-based) is unaware of that outer concurrency cap —
  // together they oversubscribe the machine badly enough to blow even
  // generous test timeouts under real (non-mocked) timing. Capped fixed,
  // matching apps/web-dashboard's vitest poolOptions fix for the same issue.
  maxWorkers: 2,
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  setupFilesAfterEnv: ['<rootDir>/../../packages/jest.setup.ts'],
  moduleNameMapper: {
    '^@ancore/types$': '<rootDir>/../types/src/index.ts',
    '^@ancore/types/(.*)$': '<rootDir>/../types/src/$1',
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 68,
      functions: 85,
      lines: 75,
      statements: 75,
    },
    // execute.ts exists today; auth/lock modules are planned but not yet present.
    './src/execute.ts': {
      branches: 4,
      functions: 60,
      lines: 25,
      statements: 25,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Only exclude integration tests that require live network access (execute.integration).
  // revoke-session-key.integration.test.ts uses mocks and runs in CI.
  testPathIgnorePatterns: ['/node_modules/', 'execute\\.integration\\.test\\.ts$'],
};
