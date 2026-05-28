import { AncoreClient, SDK_VERSION } from '@ancore/core-sdk';

import { createMobileWalletSdkClient } from '../mobile-wallet-client';

describe('createMobileWalletSdkClient', () => {
  it('initializes the core SDK client with shared network metadata', () => {
    const sdk = createMobileWalletSdkClient({
      accountContractId: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
      appName: 'Ancore Test Wallet',
      network: 'testnet',
      rpcUrl: 'https://rpc.example.test',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(sdk.client).toBeInstanceOf(AncoreClient);
    expect(sdk.accountContractId).toBe('CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526');
    expect(sdk.network).toEqual({
      network: 'testnet',
      rpcUrl: 'https://rpc.example.test',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    expect(sdk.sdkVersion).toBe(SDK_VERSION);
  });

  it('surfaces the core SDK validation error for an empty contract id', () => {
    expect(() =>
      createMobileWalletSdkClient({
        accountContractId: '',
        appName: 'Ancore Test Wallet',
        network: 'testnet',
      })
    ).toThrow('accountContractId is required');
  });
});
