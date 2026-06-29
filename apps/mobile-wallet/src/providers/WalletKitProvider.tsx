import React, { useEffect, createContext } from 'react';
import { WalletKit } from '@reown/walletkit';
import type { IWalletKit } from '@reown/walletkit';
import { WALLET_CONNECT_PROJECT_ID } from '../config/environment';

export const WalletKitContext = createContext<IWalletKit | null>(null);

export const WalletKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [walletKit, setWalletKit] = React.useState<IWalletKit | null>(null);

  useEffect(() => {
    async function init() {
      const kit = await WalletKit.init({
        projectId: WALLET_CONNECT_PROJECT_ID,
        metadata: {
          name: 'Ancore Mobile',
          description: 'Ancore Mobile Wallet',
          url: 'https://ancore.app',
          icons: [],
        },
      });
      // Register event handlers
      kit.on('session_proposal', () => {});
      kit.on('session_request', () => {});
      kit.on('session_delete', () => {});

      setWalletKit(kit);
    }
    init();
  }, []);

  return <WalletKitContext.Provider value={walletKit}>{children}</WalletKitContext.Provider>;
};
