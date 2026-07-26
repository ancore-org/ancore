import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair, Networks } from '@stellar/stellar-sdk';

const connect = vi.fn();
const disconnect = vi.fn();
const getPublicKey = vi.fn();
const sign = vi.fn();

vi.mock('@ancore/core-sdk', async () => {
  const actual = await vi.importActual<typeof import('@ancore/core-sdk')>('@ancore/core-sdk');
  return {
    ...actual,
    LedgerSigningAdapter: vi.fn().mockImplementation(() => ({
      connect,
      disconnect,
      getPublicKey,
      sign,
    })),
  };
});

import { useHardwareWalletStore } from '@/stores/hardware-wallet';
import { pairLedgerDevice, signWithLedger } from '../ledger';

describe('ledger security helpers', () => {
  const device = Keypair.random();

  beforeEach(() => {
    vi.clearAllMocks();
    useHardwareWalletStore.getState().clearPairedLedger();
    connect.mockResolvedValue({ version: '5.0.0', hashSigningEnabled: false });
    disconnect.mockResolvedValue(undefined);
    getPublicKey.mockResolvedValue({
      publicKey: device.publicKey(),
      path: "44'/148'/0'",
      accountIndex: 0,
      rawPublicKey: Buffer.from(device.rawPublicKey()),
    });
    sign.mockResolvedValue('SIGNED_XDR');
  });

  it('pairs a device and persists preference', async () => {
    const result = await pairLedgerDevice(0);
    expect(result.publicKey).toBe(device.publicKey());
    expect(useHardwareWalletStore.getState().signerMode).toBe('ledger');
    expect(useHardwareWalletStore.getState().ledgerPublicKey).toBe(device.publicKey());
    expect(disconnect).toHaveBeenCalled();
  });

  it('signs with Ledger when paired', async () => {
    useHardwareWalletStore.getState().setPairedLedger({
      publicKey: device.publicKey(),
      path: "44'/148'/0'",
      accountIndex: 0,
    });

    const signed = await signWithLedger('UNSIGNED', Networks.TESTNET);
    expect(signed).toBe('SIGNED_XDR');
    expect(sign).toHaveBeenCalledWith('UNSIGNED', Networks.TESTNET);
    expect(disconnect).toHaveBeenCalled();
  });

  it('rejects signing when unpaired', async () => {
    await expect(signWithLedger('UNSIGNED', Networks.TESTNET)).rejects.toThrow(
      /No Ledger device paired/
    );
  });
});
