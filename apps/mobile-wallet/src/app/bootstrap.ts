import { createReadOnlyAccount, type ReadOnlyAccount } from '../accounts';
import {
  loadMobileWalletEnvironment,
  type MobileWalletEnvironment,
  type MobileWalletEnvSource,
} from '../config/environment';
import { createMobileWalletSdkClient, type MobileWalletSdkClient } from '../sdk';

import { MobileSecureVault } from '../security';
import { createSecureStoreAdapter } from '../storage/secure-store-factory';

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

  const adapter = createSecureStoreAdapter();
  const vault = new MobileSecureVault(adapter);

  return {
    environment,
    sdk,
    account,
    vault,
  };
};
