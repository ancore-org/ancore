/** @type {import('jest').Config} */
// Scaffold host app: keep a node smoke suite until RN/babel Jest is fully wired.
// Full component tests live under @ancore/mobile-wallet.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/smoke.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
