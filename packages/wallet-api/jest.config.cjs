/** @type {import('jest').Config} */
module.exports = {
  // `turbo run test` runs every package concurrently, and jest's default
  // maxWorkers (CPU-count-based) is unaware of that outer concurrency cap —
  // together they oversubscribe the machine badly enough to blow even
  // generous test timeouts under real (non-mocked) timing. Capped fixed,
  // matching apps/web-dashboard's vitest poolOptions fix for the same issue.
  maxWorkers: 2,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
};
