/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  setupFilesAfterFramework: ['<rootDir>/../../packages/jest.setup.ts'],
  moduleNameMapper: {
    '^@ancore/types$': '<rootDir>/../types/src/index.ts',
    '^@ancore/types/(.*)$': '<rootDir>/../types/src/$1',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 85,
      lines: 78,
      statements: 78,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'integration\\.test\\.ts$'],
};
