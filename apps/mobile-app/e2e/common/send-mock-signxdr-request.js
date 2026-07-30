#!/usr/bin/env node
/**
 * Mock WalletConnect sign-xdr request for e2e testing
 * Injects a mock WalletConnect session_request event via adb shell
 * Used by: e2e/flows/sign-xdr.yaml
 */

const { execSync } = require('child_process');

const mockSignXdrRequest = {
  method: 'stellar_signXDR',
  params: {
    xdr: 'AAAAAgAAAABk/gj/3lFKHVPcbBTh/gV2hKYPG/xkWXcQhVwGf3CcLQAAAGQAV3YSAAAAAQAAAAAAAAAAAAAAAQAAAAAAAAAGAAAAAQAAAABk/gj/3lFKHVPcbBTh/gV2hKYPG/xkWXcQhVwGf3CcLQAAAAAAAAAAAAAAAAAAAAEAAAABVkMzSAAAAAE+F/EW2lBDJ+L6gGbP2Gkk5A8yCGEcPqH8/PnlzxBHAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAf3CcLQAAABAJh5Rw5hxVFZ5ECL3yUHjP+x8XyTWQvPbFXCMmJnP6v8XS7YvCJBiLqEYSNhB0pKKB3cHfRJ7V0qFxKWbgg==',
    description: 'Test transaction for e2e',
  },
};

try {
  const adbCmd = `adb shell "am broadcast -a com.ancore.mobile.MOCK_WC_REQUEST --es request '${JSON.stringify(
    mockSignXdrRequest
  ).replace(/'/g, "\\'")}'"`;

  console.log('📢 Sending mock WalletConnect sign-xdr request...');
  execSync(adbCmd, { stdio: 'inherit' });
  console.log('✅ Mock request sent');
} catch (err) {
  console.error('❌ Failed to send mock request:', err.message);
  process.exit(1);
}
