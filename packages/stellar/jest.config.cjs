module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**', '!src/index.ts'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 75,
      lines: 70,
      statements: 70,
    },
    // Per-module critical retry and network paths
    './src/client/**/*.ts': {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@ancore/types$': '<rootDir>/../types/src/index.ts',
  },
};
