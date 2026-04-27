module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.ts$': 'ts-jest' },
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
    './src/execute.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/auth/**/*.ts': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90,
    },
    './src/lock/**/*.ts': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@ancore/types$': '<rootDir>/../types/src/index.ts',
    '^@ancore/types/(.*)$': '<rootDir>/../types/src/$1',
  },
};
