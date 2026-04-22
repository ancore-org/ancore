module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
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
  // Exclude integration tests from default run (use `pnpm test:integration`)
  testPathIgnorePatterns: ['/node_modules/', 'integration\\.test\\.ts$'],
};
