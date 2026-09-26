import { WalletKit, type IWalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';

import { type WalletKitMetadata } from './constants';

export interface CreateWalletKitOptions {
  projectId: string;
  metadata: WalletKitMetadata;
}

/**
 * Initialize a WalletConnect WalletKit instance for React Native hosts.
 * Requires `@walletconnect/react-native-compat` to be imported before this module loads.
 */
export async function createWalletKit(options: CreateWalletKitOptions): Promise<IWalletKit> {
  const core = new Core({
    projectId: options.projectId,
  });

  return WalletKit.init({
    core,
    metadata: options.metadata,
  });
}
