import {
  createAccountPersistence,
  type SecureStorageManager,
  type AccountPersistence,
} from '@ancore/core-sdk';
import { createReadOnlyAccount, type ReadOnlyAccount } from '../accounts';
import {
  loadMobileWalletEnvironment,
  type MobileWalletEnvironment,
  type MobileWalletEnvSource,
} from '../config/environment';
import { createMobileWalletSdkClient, type MobileWalletSdkClient } from '../sdk';

import { createMobileSecureStorageManager } from '../security/mobile-storage-manager';
import { createSecureStoreAdapter } from '../storage/secure-store-factory';

export interface MobileWalletBootstrap {
  environment: MobileWalletEnvironment;
  sdk: MobileWalletSdkClient;
  account: ReadOnlyAccount;
  storageManager: SecureStorageManager;
  accounts: AccountPersistence;
  dispose: () => void;
}

export const bootstrapMobileWallet = (source: MobileWalletEnvSource): MobileWalletBootstrap => {
  const environment = loadMobileWalletEnvironment(source);
  const sdk = createMobileWalletSdkClient(environment);
  const account = createReadOnlyAccount({
    id: environment.readOnlyAccountId,
    address: environment.readOnlyAccountAddress,
    network: sdk.network,
  });

  const adapter = createSecureStoreAdapter();
  const { manager: storageManager, dispose } = createMobileSecureStorageManager(adapter);
  const accounts = createAccountPersistence(storageManager);

  return {
    environment,
    sdk,
    account,
    storageManager,
    accounts,
    dispose,
  };
};
