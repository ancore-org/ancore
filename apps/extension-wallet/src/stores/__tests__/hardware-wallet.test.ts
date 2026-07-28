import { beforeEach, describe, expect, it } from 'vitest';
import { useHardwareWalletStore } from '../hardware-wallet';

describe('useHardwareWalletStore', () => {
  beforeEach(() => {
    useHardwareWalletStore.getState().clearPairedLedger();
  });

  it('starts in software mode', () => {
    const state = useHardwareWalletStore.getState();
    expect(state.signerMode).toBe('software');
    expect(state.ledgerPublicKey).toBe('');
  });

  it('stores a paired Ledger and switches signer mode', () => {
    useHardwareWalletStore.getState().setPairedLedger({
      publicKey: 'GABC',
      path: "44'/148'/1'",
      accountIndex: 1,
      appVersion: '5.0.0',
    });

    const state = useHardwareWalletStore.getState();
    expect(state.signerMode).toBe('ledger');
    expect(state.ledgerPublicKey).toBe('GABC');
    expect(state.ledgerPath).toBe("44'/148'/1'");
    expect(state.ledgerAccountIndex).toBe(1);
    expect(state.ledgerAppVersion).toBe('5.0.0');
  });

  it('clears pairing back to software defaults', () => {
    useHardwareWalletStore.getState().setPairedLedger({
      publicKey: 'GABC',
      path: "44'/148'/0'",
      accountIndex: 0,
    });
    useHardwareWalletStore.getState().clearPairedLedger();
    expect(useHardwareWalletStore.getState().signerMode).toBe('software');
    expect(useHardwareWalletStore.getState().ledgerPublicKey).toBe('');
  });
});
