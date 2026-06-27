import { createReadOnlyAccount, type ReadOnlyAccount } from '../accounts';
import {
  loadMobileWalletEnvironment,
  type MobileWalletEnvironment,
  type MobileWalletEnvSource,
} from '../config/environment';
import { createMobileWalletSdkClient, type MobileWalletSdkClient } from '../sdk';

import { MobileSecureVault } from '../security';
import { KeychainSecureStoreAdapter } from '../security/KeychainAdapter';
import { MemorySecureStoreAdapter } from '../storage/mobile-secure-storage-adapter';

export interface MobileWalletBootstrap {
  environment: MobileWalletEnvironment;
  sdk: MobileWalletSdkClient;
  account: ReadOnlyAccount;
  vault: MobileSecureVault;
}

export const bootstrapMobileWallet = (source: MobileWalletEnvSource): MobileWalletBootstrap => {
  const environment = loadMobileWalletEnvironment(source);
  const sdk = createMobileWalletSdkClient(environment);
  const account = createReadOnlyAccount({
    id: environment.readOnlyAccountId,
    address: environment.readOnlyAccountAddress,
    network: sdk.network,
  });

  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const adapter = isTest ? new MemorySecureStoreAdapter() : new KeychainSecureStoreAdapter();
  const vault = new MobileSecureVault(adapter);

  return {
    environment,
    sdk,
    account,
    vault,
  };
};
