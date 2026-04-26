/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
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
    '!src/encoding.ts',
    '!src/hashing.ts',
    '!src/keys.ts',
    '!src/types/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 73,
      lines: 77,
      statements: 77,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
};
