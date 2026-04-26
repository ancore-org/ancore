/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  setupFilesAfterFramework: ['<rootDir>/../../packages/jest.setup.ts'],
  moduleNameMapper: {
    '^@ancore/account-abstraction$': '<rootDir>/../account-abstraction/src/index.ts',
    '^@ancore/account-abstraction/(.*)$': '<rootDir>/../account-abstraction/src/$1',
    '^@ancore/stellar$': '<rootDir>/../stellar/src/index.ts',
    '^@ancore/stellar/(.*)$': '<rootDir>/../stellar/src/$1',
    '^@ancore/types$': '<rootDir>/../types/src/index.ts',
    '^@ancore/types/(.*)$': '<rootDir>/../types/src/$1',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/execute-with-session-key.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 62,
      functions: 82,
      lines: 77,
      statements: 78,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'integration\\.test\\.ts$'],
};
