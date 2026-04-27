module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@ancore/account-abstraction$': '<rootDir>/../account-abstraction/src/index.ts',
    '^@ancore/account-abstraction/(.*)$': '<rootDir>/../account-abstraction/src/$1',
    '^@ancore/stellar$': '<rootDir>/../stellar/src/index.ts',
    '^@ancore/stellar/(.*)$': '<rootDir>/../stellar/src/$1',
    '^@ancore/types$': '<rootDir>/../types/src/index.ts',
    '^@ancore/types/(.*)$': '<rootDir>/../types/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 90,
      lines: 85,
      statements: 85,
    },
    // Per-module critical security paths
    './src/execute-with-session-key.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/session/**/*.ts': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90,
    },
    './src/wallet/**/*.ts': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Exclude integration tests from default run (use `pnpm test:integration`)
  testPathIgnorePatterns: ['/node_modules/', 'integration\\.test\\.ts$'],
};
