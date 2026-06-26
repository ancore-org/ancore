import {
  createHorizonNativeBalanceFetcher,
  discoverFundedHdAccounts,
  type DiscoveredHdAccount,
} from '@ancore/core-sdk';
import { StellarClient } from '@ancore/stellar';
import type { Network } from '@ancore/types';

import type { DiscoverAccountsFn } from '../screens/onboarding/WalletImportScreen';

export function createHdAccountDiscovery(network: Network = 'testnet'): DiscoverAccountsFn {
  const client = new StellarClient({ network });

  return async (mnemonic, options) => {
    return discoverFundedHdAccounts({
      mnemonic,
      signal: options?.signal,
      onProgress: options?.onProgress,
      fetchNativeBalance: createHorizonNativeBalanceFetcher(client),
    });
  };
}

export type { DiscoveredHdAccount };
