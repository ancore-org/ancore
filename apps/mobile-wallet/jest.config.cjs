/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // `turbo run test` runs every package concurrently, and jest's default
  // maxWorkers (CPU-count-based) is unaware of that outer concurrency cap —
  // together they oversubscribe the machine badly enough to blow even
  // generous test timeouts under real (non-mocked) timing. Capped fixed,
  // matching apps/web-dashboard's vitest poolOptions fix for the same issue.
  maxWorkers: 2,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/../../packages/jest.setup.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/test/**',
  ],
  coverageDirectory: 'coverage',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@ancore/(.+)$': '<rootDir>/../../packages/$1/src',
  },
};
