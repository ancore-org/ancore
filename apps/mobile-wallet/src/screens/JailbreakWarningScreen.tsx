/**
 * Jailbreak / root warning screen.
 *
 * Displayed when the app detects a compromised device.
 * In production: hard-blocks access with an explanation.
 * In development (__DEV__): shows a "Continue anyway" option.
 *
 * Freighter reference: jail-monkey warning gate on app launch.
 */

import { useState } from 'react';

interface Props {
  /** Called when the user chooses to continue (only available in __DEV__). */
  onContinueAnyway?: () => void;
}

// eslint-disable-next-line no-undef
const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export function JailbreakWarningScreen({ onContinueAnyway }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <main
      aria-label="Security warning"
      className="flex min-h-screen flex-col items-center justify-center bg-red-50 px-6 text-center"
    >
      <div aria-hidden="true" className="mb-4 text-5xl">
        ⚠️
      </div>
      <h1 className="text-2xl font-bold text-red-800">Security Warning</h1>
      <p className="mt-3 max-w-sm text-sm text-red-700">
        This device appears to be jailbroken or rooted. For your security, the wallet cannot run on
        compromised devices.
      </p>
      <p className="mt-2 max-w-sm text-xs text-red-600">
        Jailbroken devices can expose your private keys and recovery phrase to malware. The Keychain
        and secure storage cannot be trusted on this device.
      </p>

      {IS_DEV && (
        <>
          <label className="mt-6 flex items-center gap-2 text-sm text-red-800">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            I understand the risks (development only)
          </label>
          <button
            disabled={!acknowledged}
            onClick={onContinueAnyway}
            type="button"
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue anyway
          </button>
        </>
      )}
    </main>
  );
}
