module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/types/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 88,
      statements: 88,
    },
    // Per-module critical cryptographic paths
    './src/keys.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/signing/**/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/encryption/**/*.ts': {
      branches: 90,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
