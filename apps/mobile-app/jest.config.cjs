/** @type {import('jest').Config} */
// Scaffold host app: keep a node smoke suite until RN/babel Jest is fully wired.
// Full component tests live under @ancore/mobile-wallet.
module.exports = {
  // `turbo run test` runs every package concurrently, and jest's default
  // maxWorkers (CPU-count-based) is unaware of that outer concurrency cap —
  // together they oversubscribe the machine badly enough to blow even
  // generous test timeouts under real (non-mocked) timing. Capped fixed,
  // matching apps/web-dashboard's vitest poolOptions fix for the same issue.
  maxWorkers: 2,
  testEnvironment: 'node',
  testMatch: ['**/__tests__/smoke.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
