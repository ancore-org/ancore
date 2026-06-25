import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SessionTypes } from '@walletconnect/types';

// Abstract WalletKit interface - to be implemented with actual @reown/walletkit API
interface IWalletKit {
  init(options: {
    projectId: string;
    metadata: { name: string; description: string; url: string; icons: string[] };
  }): Promise<void>;
  pair(params: { uri: string }): Promise<void>;
  approveSession(params: { id: number; namespaces: Record<string, unknown> }): Promise<void>;
  rejectSession(params: { id: number; reason: { code: number; message: string } }): Promise<void>;
  disconnectSession(params: {
    topic: string;
    reason: { code: number; message: string };
  }): Promise<void>;
  getActiveSessions(): SessionTypes.Struct[];
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
}

interface WalletConnectContextType {
  walletKit: IWalletKit | null;
  sessions: SessionTypes.Struct[];
  pair: (uri: string) => Promise<void>;
  approveSession: (proposal: {
    id: number;
    params: { requiredNamespaces: Record<string, unknown> };
  }) => Promise<void>;
  rejectSession: (proposal: { id: number }) => Promise<void>;
  disconnectSession: (topic: string) => Promise<void>;
  isInitialized: boolean;
}

const WalletConnectContext = createContext<WalletConnectContextType | null>(null);

interface WalletKitProviderProps {
  children: ReactNode;
  projectId: string;
  walletKitInstance?: IWalletKit; // Allow injection for testing
}

export const WalletKitProvider: React.FC<WalletKitProviderProps> = ({
  children,
  projectId,
  walletKitInstance,
}) => {
  const [walletKit] = useState<IWalletKit | null>(walletKitInstance || null);
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Skip initialization if walletKitInstance is provided (for testing)
    if (walletKitInstance) {
      setIsInitialized(true);
      return;
    }

    const initializeWalletKit = async () => {
      try {
        // TODO: Initialize actual WalletKit once API is confirmed
        // const WalletKit = (await import('@reown/walletkit')).default;
        // const instance = new WalletKit({ projectId });
        // await instance.init({ projectId, metadata: {...} });

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize WalletKit:', error);
      }
    };

    initializeWalletKit();
  }, [projectId, walletKitInstance]);

  const pair = async (uri: string): Promise<void> => {
    if (!walletKit) {
      throw new Error('WalletKit not initialized');
    }

    try {
      await walletKit.pair({ uri });
    } catch (error) {
      console.error('Failed to pair:', error);
      throw error;
    }
  };

  const approveSession = async (proposal: {
    id: number;
    params: { requiredNamespaces: Record<string, unknown> };
  }): Promise<void> => {
    if (!walletKit) {
      throw new Error('WalletKit not initialized');
    }

    try {
      const { id, params } = proposal;
      const { requiredNamespaces } = params;

      // TODO: Get accounts from vault once sign service is integrated
      // For now, this will be mocked in tests
      const accounts: string[] = [];

      const approvedNamespaces: Record<
        string,
        { accounts: string[]; methods: string[]; events: string[]; chains: string[] }
      > = {};

      for (const [key, namespace] of Object.entries(requiredNamespaces)) {
        const ns = namespace as
          | { chains?: string[]; methods?: string[]; events?: string[] }
          | undefined;
        approvedNamespaces[key] = {
          accounts: accounts.filter((acc) => acc.startsWith(key.split(':')[0])),
          methods: ns?.methods || [],
          events: ns?.events || [],
          chains: ns?.chains || [],
        };
      }

      await walletKit.approveSession({
        id,
        namespaces: approvedNamespaces,
      });

      setSessions(Object.values(walletKit.getActiveSessions()));
    } catch (error) {
      console.error('Failed to approve session:', error);
      throw error;
    }
  };

  const rejectSession = async (proposal: { id: number }): Promise<void> => {
    if (!walletKit) {
      throw new Error('WalletKit not initialized');
    }

    try {
      const { id } = proposal;
      await walletKit.rejectSession({
        id,
        reason: {
          code: 4001,
          message: 'User rejected the session proposal',
        },
      });
    } catch (error) {
      console.error('Failed to reject session:', error);
      throw error;
    }
  };

  const disconnectSession = async (topic: string): Promise<void> => {
    if (!walletKit) {
      throw new Error('WalletKit not initialized');
    }

    try {
      await walletKit.disconnectSession({
        topic,
        reason: {
          code: 6000,
          message: 'User disconnected the session',
        },
      });

      setSessions(Object.values(walletKit.getActiveSessions()));
    } catch (error) {
      console.error('Failed to disconnect session:', error);
      throw error;
    }
  };

  const value: WalletConnectContextType = {
    walletKit,
    sessions,
    pair,
    approveSession,
    rejectSession,
    disconnectSession,
    isInitialized,
  };

  return <WalletConnectContext.Provider value={value}>{children}</WalletConnectContext.Provider>;
};

export const useWalletConnect = (): WalletConnectContextType => {
  const context = useContext(WalletConnectContext);
  if (!context) {
    throw new Error('useWalletConnect must be used within WalletKitProvider');
  }
  return context;
};
