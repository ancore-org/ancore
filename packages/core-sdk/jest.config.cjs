/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/../../packages/jest.setup.ts'],
  moduleNameMapper: {
    '^@ancore/account-abstraction$': '<rootDir>/../account-abstraction/src/index.ts',
    '^@ancore/account-abstraction/(.*)$': '<rootDir>/../account-abstraction/src/$1',
    '^@ancore/stellar$': '<rootDir>/../stellar/src/index.ts',
    '^@ancore/stellar/(.*)$': '<rootDir>/../stellar/src/$1',
    '^@ancore/types$': '<rootDir>/../types/src/index.ts',
    '^@ancore/types/(.*)$': '<rootDir>/../types/src/$1',
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 90,
      lines: 85,
      statements: 85,
    },
    // Keep thresholds on files that currently exist and have active tests.
    './src/execute-with-session-key.ts': {
      branches: 0,
      functions: 0,
      lines: 10,
      statements: 10,
    },
    './src/wallet.ts': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'integration\\.test\\.ts$'],
};
