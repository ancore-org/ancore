import { createReadOnlyAccount, type ReadOnlyAccount } from '../accounts';
import {
  loadMobileWalletEnvironment,
  type MobileWalletEnvironment,
  type MobileWalletEnvSource,
} from '../config/environment';
import { createMobileWalletSdkClient, type MobileWalletSdkClient } from '../sdk';

export interface MobileWalletBootstrap {
  environment: MobileWalletEnvironment;
  sdk: MobileWalletSdkClient;
  account: ReadOnlyAccount;
}

export const bootstrapMobileWallet = (source: MobileWalletEnvSource): MobileWalletBootstrap => {
  const environment = loadMobileWalletEnvironment(source);
  const sdk = createMobileWalletSdkClient(environment);
  const account = createReadOnlyAccount({
    id: environment.readOnlyAccountId,
    address: environment.readOnlyAccountAddress,
    network: sdk.network,
  });

  return {
    environment,
    sdk,
    account,
  };
};
