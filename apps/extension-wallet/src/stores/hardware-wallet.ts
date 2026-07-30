/**
 * Hardware wallet (Ledger) preferences.
 * Pairing runs in the popup (WebHID user gesture); background never holds device handles.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';

export type SignerMode = 'software' | 'ledger';

export interface HardwareWalletState {
  signerMode: SignerMode;
  /** BIP-44 account index for `m/44'/148'/{n}'`. */
  ledgerAccountIndex: number;
  /** Last paired Ledger G-address (empty when unpaired). */
  ledgerPublicKey: string;
  /** Derivation path last confirmed with the device. */
  ledgerPath: string;
  /** Ledger Stellar app version from last successful pair. */
  ledgerAppVersion: string;

  setSignerMode: (mode: SignerMode) => void;
  setLedgerAccountIndex: (index: number) => void;
  setPairedLedger: (payload: {
    publicKey: string;
    path: string;
    accountIndex: number;
    appVersion?: string;
  }) => void;
  clearPairedLedger: () => void;
}

const DEFAULTS = {
  signerMode: 'software' as SignerMode,
  ledgerAccountIndex: 0,
  ledgerPublicKey: '',
  ledgerPath: '',
  ledgerAppVersion: '',
};

export const useHardwareWalletStore = create<HardwareWalletState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setSignerMode: (signerMode) => set({ signerMode }),

      setLedgerAccountIndex: (ledgerAccountIndex) => {
        if (!Number.isInteger(ledgerAccountIndex) || ledgerAccountIndex < 0) {
          return;
        }
        set({ ledgerAccountIndex });
      },

      setPairedLedger: ({ publicKey, path, accountIndex, appVersion }) =>
        set({
          ledgerPublicKey: publicKey,
          ledgerPath: path,
          ledgerAccountIndex: accountIndex,
          ledgerAppVersion: appVersion ?? '',
          signerMode: 'ledger',
        }),

      clearPairedLedger: () =>
        set({
          ...DEFAULTS,
        }),
    }),
    {
      name: 'ancore_hardware_wallet',
      version: 1,
      storage: createJSONStorage(() => extensionStorage),
    }
  )
);

export function getHardwareWalletState(): Pick<
  HardwareWalletState,
  'signerMode' | 'ledgerAccountIndex' | 'ledgerPublicKey' | 'ledgerPath' | 'ledgerAppVersion'
> {
  const s = useHardwareWalletStore.getState();
  return {
    signerMode: s.signerMode,
    ledgerAccountIndex: s.ledgerAccountIndex,
    ledgerPublicKey: s.ledgerPublicKey,
    ledgerPath: s.ledgerPath,
    ledgerAppVersion: s.ledgerAppVersion,
  };
}
