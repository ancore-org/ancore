#!/usr/bin/env node
/**
 * Mock WalletConnect sign-xdr request for e2e testing.
 * Android: adb broadcast to MockWalletConnectReceiver.
 * iOS: simctl openurl with ancoredev://mock-wc deep link.
 */

const { execSync } = require('child_process');

const mockSignXdrRequest = {
  method: 'stellar_signXDR',
  params: {
    xdr: 'AAAAAgAAAABk/gj/3lFKHVPcbBTh/gV2hKYPG/xkWXcQhVwGf3CcLQAAAGQAV3YSAAAAAQAAAAAAAAAAAAAAAQAAAAAAAAAGAAAAAQAAAABk/gj/3lFKHVPcbBTh/gV2hKYPG/xkWXcQhVwGf3CcLQAAAAAAAAAAAAAAAAAAAAEAAAABVkMzSAAAAAE+F/EW2lBDJ+L6gGbP2Gkk5A8yCGEcPqH8/PnlzxBHAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAf3CcLQAAABAJh5Rw5hxVFZ5ECL3yUHjP+x8XyTWQvPbFXCMmJnP6v8XS7YvCJBiLqEYSNhB0pKKB3cHfRJ7V0qFxKWbgg==',
    description: 'Test transaction for e2e',
  },
};

const payload = encodeURIComponent(JSON.stringify(mockSignXdrRequest));

function runAndroid() {
  const adbCmd = `adb shell "am broadcast -a org.ancore.wallet.dev.MOCK_WC_REQUEST --es request '${JSON.stringify(
    mockSignXdrRequest
  ).replace(/'/g, "\\'")}'"`;

  console.log('📢 Sending mock WalletConnect sign-xdr request (Android)...');
  execSync(adbCmd, { stdio: 'inherit' });
}

function runIos() {
  const url = `ancoredev://mock-wc?request=${payload}`;
  const iosCmd = `xcrun simctl openurl booted "${url}"`;

  console.log('📢 Sending mock WalletConnect sign-xdr request (iOS)...');
  execSync(iosCmd, { stdio: 'inherit' });
}

try {
  const platform = process.env.E2E_PLATFORM?.toLowerCase();

  if (platform === 'ios') {
    runIos();
  } else if (platform === 'android') {
    runAndroid();
  } else {
    try {
      execSync('adb get-state', { stdio: 'ignore' });
      runAndroid();
    } catch {
      runIos();
    }
  }

  console.log('✅ Mock request sent');
} catch (err) {
  console.error('❌ Failed to send mock request:', err.message);
  process.exit(1);
}
