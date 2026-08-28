import baseConfig from './playwright.config';

export default {
  ...baseConfig,
  testMatch: /visual\.spec\.ts$/,
  snapshotPathTemplate: '{testDir}/snapshots/{arg}{ext}',
};
