// @ts-nocheck
import { AncoreClient, SDK_VERSION } from '@ancore/core-sdk';
import type { NetworkConfig } from '@ancore/types';

import type { MobileWalletEnvironment } from '../config/environment';

export interface MobileWalletSdkClient {
  readonly client: unknown;
  readonly accountContractId: string;
  readonly network: NetworkConfig;
  readonly sdkVersion: string;
}

export const createMobileWalletSdkClient = (
  environment: MobileWalletEnvironment
): MobileWalletSdkClient => {
  const client = new AncoreClient({
    accountContractId: environment.accountContractId,
  });

  return {
    client,
    accountContractId: environment.accountContractId,
    network: {
      network: environment.network,
      rpcUrl: environment.rpcUrl,
      networkPassphrase: environment.networkPassphrase,
    },
    sdkVersion: SDK_VERSION,
  };
};
