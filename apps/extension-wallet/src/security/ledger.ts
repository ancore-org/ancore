/**
 * Popup-side Ledger helpers — WebHID must run in a visible extension document.
 */

import {
  LedgerErrorCode,
  LedgerSigningAdapter,
  LedgerSigningError,
  type LedgerPublicKeyResult,
} from '@ancore/core-sdk';
import { useHardwareWalletStore } from '@/stores/hardware-wallet';

export async function pairLedgerDevice(accountIndex?: number): Promise<LedgerPublicKeyResult> {
  const index = accountIndex ?? useHardwareWalletStore.getState().ledgerAccountIndex;
  const adapter = new LedgerSigningAdapter({ accountIndex: index });

  try {
    const appInfo = await adapter.connect();
    const key = await adapter.getPublicKey(true);
    useHardwareWalletStore.getState().setPairedLedger({
      publicKey: key.publicKey,
      path: key.path,
      accountIndex: key.accountIndex,
      appVersion: appInfo.version,
    });
    return key;
  } finally {
    await adapter.disconnect();
  }
}

export async function signWithLedger(
  unsignedXdr: string,
  networkPassphrase: string
): Promise<string> {
  const { ledgerAccountIndex, ledgerPublicKey, signerMode } = useHardwareWalletStore.getState();
  if (signerMode !== 'ledger' || !ledgerPublicKey) {
    throw new LedgerSigningError(
      LedgerErrorCode.NOT_CONNECTED,
      'No Ledger device paired — connect one in Settings → Hardware wallet'
    );
  }

  const adapter = new LedgerSigningAdapter({ accountIndex: ledgerAccountIndex });
  try {
    await adapter.connect();
    const onDevice = await adapter.getPublicKey(false);
    if (onDevice.publicKey !== ledgerPublicKey) {
      throw new Error(
        'Connected Ledger account does not match the paired address. Re-pair in Settings.'
      );
    }
    return await adapter.sign(unsignedXdr, networkPassphrase);
  } finally {
    await adapter.disconnect();
  }
}

export function formatLedgerError(err: unknown): string {
  if (err instanceof LedgerSigningError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Ledger signing failed';
}
