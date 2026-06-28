import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { SessionTypes } from '@walletconnect/types';
import { SessionApprovalSheet, SessionProposal } from '../components/SessionApprovalSheet';
import {
  SignAuthEntryApprovalSheet,
  parseSignAuthEntryRequest,
  type SignAuthEntryRequest,
} from '../components/SignAuthEntryApprovalSheet';
import {
  createStellarRpcHandlers,
  handleStellarRpcRequest,
  type StellarRpcHandlers,
} from './stellar-handlers';
import type { ParsedAuthEntry } from '../walletconnect/auth-entry-parser';

interface SessionRequestEvent {
  id: number;
  topic: string;
  params: {
    request: {
      method: string;
      params: unknown;
    };
  };
}

// Abstract WalletKit interface - to be implemented with actual @reown/walletkit API
export interface IWalletKit {
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
  respondSessionRequest(params: {
    topic: string;
    response: {
      id: number;
      jsonrpc: '2.0';
      result?: unknown;
      error?: { code: number; message: string };
    };
  }): Promise<void>;
  getActiveSessions(): Record<string, SessionTypes.Struct>;
  on(event: string, callback: (...args: unknown[]) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
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
  pendingProposal: SessionProposal | null;
  clearPendingProposal: () => void;
  pendingSignAuthEntry: SignAuthEntryRequest | null;
}

const WalletConnectContext = createContext<WalletConnectContextType | null>(null);

interface WalletKitProviderProps {
  children: ReactNode;
  projectId: string;
  walletKitInstance?: IWalletKit;
  stellarHandlers?: StellarRpcHandlers;
}

export const WalletKitProvider: React.FC<WalletKitProviderProps> = ({
  children,
  projectId,
  walletKitInstance,
  stellarHandlers,
}) => {
  const [walletKit] = useState<IWalletKit | null>(walletKitInstance || null);
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<SessionProposal | null>(null);
  const [pendingSignAuthEntry, setPendingSignAuthEntry] = useState<SignAuthEntryRequest | null>(
    null
  );
  const [parsedAuthEntry, setParsedAuthEntry] = useState<ParsedAuthEntry | null>(null);

  const handlers = stellarHandlers ?? createStellarRpcHandlers();

  useEffect(() => {
    if (walletKitInstance) {
      setIsInitialized(true);
      return;
    }

    const initializeWalletKit = async () => {
      try {
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

    await walletKit.pair({ uri });
  };

  const approveSession = async (proposal: {
    id: number;
    params: { requiredNamespaces: Record<string, unknown> };
  }): Promise<void> => {
    if (!walletKit) {
      throw new Error('WalletKit not initialized');
    }

    const { id, params } = proposal;
    const { requiredNamespaces } = params;

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

    await walletKit.approveSession({ id, namespaces: approvedNamespaces });
    setSessions(Object.values(walletKit.getActiveSessions()));
  };

  const rejectSession = async (proposal: { id: number }): Promise<void> => {
    if (!walletKit) {
      throw new Error('WalletKit not initialized');
    }

    await walletKit.rejectSession({
      id: proposal.id,
      reason: { code: 4001, message: 'User rejected the session proposal' },
    });
  };

  const disconnectSession = async (topic: string): Promise<void> => {
    if (!walletKit) {
      throw new Error('WalletKit not initialized');
    }

    await walletKit.disconnectSession({
      topic,
      reason: { code: 6000, message: 'User disconnected the session' },
    });

    setSessions(Object.values(walletKit.getActiveSessions()));
  };

  const clearPendingProposal = () => setPendingProposal(null);

  const respondAuthEntrySuccess = useCallback(
    async (request: SignAuthEntryRequest, result: { signedAuthEntry: string }) => {
      if (!walletKit) return;

      await walletKit.respondSessionRequest({
        topic: request.topic,
        response: {
          id: request.id,
          jsonrpc: '2.0',
          result,
        },
      });
    },
    [walletKit]
  );

  const respondAuthEntryReject = useCallback(
    async (request: SignAuthEntryRequest) => {
      if (!walletKit) return;

      await walletKit.respondSessionRequest({
        topic: request.topic,
        response: {
          id: request.id,
          jsonrpc: '2.0',
          error: { code: 4001, message: 'User rejected the request' },
        },
      });
    },
    [walletKit]
  );

  const handleSessionRequest = useCallback(
    async (rawEvent: unknown) => {
      if (!walletKit) return;

      const event = rawEvent as SessionRequestEvent & { session: SessionTypes.Struct };
      const method = event.params?.request?.method;
      const params = event.params?.request?.params;

      if (method === 'stellar_signAuthEntry') {
        const { request, parsed } = parseSignAuthEntryRequest({
          id: event.id,
          topic: event.topic,
          params,
          session: event.session,
        });
        setParsedAuthEntry(parsed);
        setPendingSignAuthEntry(request);
        return;
      }

      const session = event.session ?? walletKit.getActiveSessions()[event.topic];
      if (!session) {
        await walletKit.respondSessionRequest({
          topic: event.topic,
          response: {
            id: event.id,
            jsonrpc: '2.0',
            error: { code: 4100, message: 'Session not found' },
          },
        });
        return;
      }

      try {
        const result = await handleStellarRpcRequest(method, params, session, handlers);
        await walletKit.respondSessionRequest({
          topic: event.topic,
          response: { id: event.id, jsonrpc: '2.0', result },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        await walletKit.respondSessionRequest({
          topic: event.topic,
          response: {
            id: event.id,
            jsonrpc: '2.0',
            error: { code: 4001, message },
          },
        });
      }
    },
    [handlers, walletKit]
  );

  useEffect(() => {
    if (!walletKit || !isInitialized) return;

    const handleSessionProposal = (...args: unknown[]) => {
      setPendingProposal(args[0] as SessionProposal);
    };

    walletKit.on('session_proposal', handleSessionProposal);
    walletKit.on('session_request', handleSessionRequest);

    return () => {
      walletKit.off('session_proposal', handleSessionProposal);
      walletKit.off('session_request', handleSessionRequest);
    };
  }, [walletKit, isInitialized, handleSessionRequest]);

  useEffect(() => {
    if (!pendingProposal) return;

    const timer = setTimeout(() => {
      setPendingProposal(null);
    }, 60_000);

    return () => clearTimeout(timer);
  }, [pendingProposal]);

  const handleSheetApprove = async () => {
    if (!pendingProposal) return;
    try {
      await approveSession(pendingProposal);
    } finally {
      setPendingProposal(null);
    }
  };

  const handleSheetReject = async () => {
    if (!pendingProposal) return;
    try {
      await rejectSession({ id: pendingProposal.id });
    } finally {
      setPendingProposal(null);
    }
  };

  const handleAuthEntryApprove = async () => {
    if (!pendingSignAuthEntry || !walletKit) return;

    const session = walletKit.getActiveSessions()[pendingSignAuthEntry.topic];
    if (!session) {
      await respondAuthEntryReject(pendingSignAuthEntry);
      setPendingSignAuthEntry(null);
      setParsedAuthEntry(null);
      return;
    }

    try {
      const result = await handlers.handleStellarSignAuthEntry(
        { authEntry: pendingSignAuthEntry.params.authEntry ?? '' },
        session
      );
      await respondAuthEntrySuccess(pendingSignAuthEntry, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed';
      await walletKit.respondSessionRequest({
        topic: pendingSignAuthEntry.topic,
        response: {
          id: pendingSignAuthEntry.id,
          jsonrpc: '2.0',
          error: { code: 4001, message },
        },
      });
    } finally {
      setPendingSignAuthEntry(null);
      setParsedAuthEntry(null);
    }
  };

  const handleAuthEntryReject = async () => {
    if (!pendingSignAuthEntry) return;
    try {
      await respondAuthEntryReject(pendingSignAuthEntry);
    } finally {
      setPendingSignAuthEntry(null);
      setParsedAuthEntry(null);
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
    pendingProposal,
    clearPendingProposal,
    pendingSignAuthEntry,
  };

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
      {pendingProposal && (
        <SessionApprovalSheet
          proposal={pendingProposal}
          onApprove={handleSheetApprove}
          onReject={handleSheetReject}
        />
      )}
      {pendingSignAuthEntry && parsedAuthEntry && (
        <SignAuthEntryApprovalSheet
          request={pendingSignAuthEntry}
          parsed={parsedAuthEntry}
          onApprove={handleAuthEntryApprove}
          onReject={handleAuthEntryReject}
        />
      )}
    </WalletConnectContext.Provider>
  );
};

export const useWalletConnect = (): WalletConnectContextType => {
  const context = useContext(WalletConnectContext);
  if (!context) {
    throw new Error('useWalletConnect must be used within WalletKitProvider');
  }
  return context;
};
