import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import type { IWalletKit } from '@reown/walletkit';
import { SessionTypes } from '@walletconnect/types';
import { SessionApprovalSheet, SessionProposal } from '../components/SessionApprovalSheet';
import {
  SignAuthEntryApprovalSheet,
  parseSignAuthEntryRequest,
  type SignAuthEntryRequest,
} from '../components/SignAuthEntryApprovalSheet';
import {
  SignXdrApprovalSheet,
  parseSignXdrRequest,
  type SignXdrRequest,
} from '../components/SignXdrApprovalSheet';
import {
  createStellarRpcHandlers,
  handleStellarRpcRequest,
  type StellarRpcHandlers,
} from './stellar-handlers';
import type { ParsedAuthEntry } from '../walletconnect/auth-entry-parser';
import { buildApprovedSessionNamespaces } from '../walletconnect/approve-session';
import {
  buildWalletKitMetadata,
  type StellarRpcChain,
  type WalletKitMetadataInput,
} from '../walletconnect/constants';
import { createWalletKit } from '../walletconnect/create-wallet-kit';
import {
  createDevMockSession,
  createDevMockSessionProposal,
  isDevMockPairingUri,
  isDevMockSessionProposal,
} from '../walletconnect/dev-mock';
import {
  isDevMockWalletConnectDeepLink,
  parseDevMockWalletConnectDeepLink,
} from '../walletconnect/dev-mock-deeplink';
import { subscribeToWalletConnectDeepLinks } from '../linking/walletConnectLinking';

export type { IWalletKit };

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
  metadata?: WalletKitMetadataInput;
  activeChain?: StellarRpcChain;
  activeAccount?: string;
}

export const WalletKitProvider: React.FC<WalletKitProviderProps> = ({
  children,
  projectId,
  walletKitInstance,
  stellarHandlers,
  metadata,
  activeChain,
  activeAccount,
}) => {
  const [walletKit, setWalletKit] = useState<IWalletKit | null>(walletKitInstance ?? null);
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [isInitialized, setIsInitialized] = useState(Boolean(walletKitInstance));
  const resolvedMetadata = useMemo(
    () => buildWalletKitMetadata(metadata ?? { name: 'Ancore Wallet' }),
    [metadata]
  );
  const [pendingProposal, setPendingProposal] = useState<SessionProposal | null>(null);
  const [pendingSignAuthEntry, setPendingSignAuthEntry] = useState<SignAuthEntryRequest | null>(
    null
  );
  const [pendingSignXdr, setPendingSignXdr] = useState<SignXdrRequest | null>(null);
  const [signXdrStatus, setSignXdrStatus] = useState<'pending' | 'success'>('pending');
  const [parsedAuthEntry, setParsedAuthEntry] = useState<ParsedAuthEntry | null>(null);
  const [devMockSessions, setDevMockSessions] = useState<Record<string, SessionTypes.Struct>>({});

  const handlers = useMemo(() => stellarHandlers ?? createStellarRpcHandlers(), [stellarHandlers]);

  const getAllSessions = useCallback((): Record<string, SessionTypes.Struct> => {
    return {
      ...(walletKit?.getActiveSessions() ?? {}),
      ...devMockSessions,
    };
  }, [walletKit, devMockSessions]);

  const respondSessionRequest = useCallback(
    async (params: {
      topic: string;
      response: {
        id: number;
        jsonrpc: '2.0';
        result?: unknown;
        error?: { code: number; message: string };
      };
    }) => {
      if (!walletKit || devMockSessions[params.topic]) {
        return;
      }

      await walletKit.respondSessionRequest(
        params as Parameters<IWalletKit['respondSessionRequest']>[0]
      );
    },
    [walletKit, devMockSessions]
  );

  const refreshSessions = useCallback(() => {
    setSessions(Object.values(getAllSessions()));
  }, [getAllSessions]);

  const pair = useCallback(
    async (uri: string): Promise<void> => {
      if (!walletKit) {
        throw new Error('WalletKit not initialized');
      }

      if (isDevMockPairingUri(uri)) {
        setPendingProposal(createDevMockSessionProposal());
        return;
      }

      await walletKit.pair({ uri });
    },
    [walletKit]
  );

  const approveSession = useCallback(
    async (proposal: {
      id: number;
      params: { requiredNamespaces: Record<string, unknown> };
    }): Promise<void> => {
      if (!walletKit) {
        throw new Error('WalletKit not initialized');
      }

      if (isDevMockSessionProposal(proposal)) {
        const session = createDevMockSession(activeAccount);
        setDevMockSessions((current) => {
          const next = { ...current, [session.topic]: session };
          setSessions(Object.values({ ...(walletKit?.getActiveSessions() ?? {}), ...next }));
          return next;
        });
        return;
      }

      const approvedNamespaces = buildApprovedSessionNamespaces({
        proposal: proposal as SessionProposal,
        activeChain,
        activeAccount,
      });

      await walletKit.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces as SessionTypes.Namespaces,
      });
      refreshSessions();
    },
    [walletKit, activeChain, activeAccount, refreshSessions]
  );

  const rejectSession = useCallback(
    async (proposal: { id: number }): Promise<void> => {
      if (!walletKit) {
        throw new Error('WalletKit not initialized');
      }

      await walletKit.rejectSession({
        id: proposal.id,
        reason: { code: 4001, message: 'User rejected the session proposal' },
      });
    },
    [walletKit]
  );

  const disconnectSession = useCallback(
    async (topic: string): Promise<void> => {
      if (!walletKit) {
        throw new Error('WalletKit not initialized');
      }

      await walletKit.disconnectSession({
        topic,
        reason: { code: 6000, message: 'User disconnected the session' },
      });

      refreshSessions();
    },
    [walletKit, refreshSessions]
  );

  useEffect(() => {
    if (walletKitInstance) {
      setWalletKit(walletKitInstance);
      setIsInitialized(true);
      setSessions(Object.values(walletKitInstance.getActiveSessions()));
      return;
    }

    let cancelled = false;

    const initializeWalletKit = async () => {
      try {
        const kit = await createWalletKit({
          projectId,
          metadata: resolvedMetadata,
        });

        if (cancelled) {
          return;
        }

        setWalletKit(kit);
        setIsInitialized(true);
        setSessions(Object.values(kit.getActiveSessions()));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to initialize WalletKit:', error);
        }
      }
    };

    void initializeWalletKit();

    return () => {
      cancelled = true;
    };
  }, [projectId, walletKitInstance, resolvedMetadata]);

  const clearPendingProposal = () => setPendingProposal(null);

  const respondAuthEntrySuccess = useCallback(
    async (request: SignAuthEntryRequest, result: { signedAuthEntry: string }) => {
      await respondSessionRequest({
        topic: request.topic,
        response: {
          id: request.id,
          jsonrpc: '2.0',
          result,
        },
      });
    },
    [respondSessionRequest]
  );

  const respondAuthEntryReject = useCallback(
    async (request: SignAuthEntryRequest) => {
      await respondSessionRequest({
        topic: request.topic,
        response: {
          id: request.id,
          jsonrpc: '2.0',
          error: { code: 4001, message: 'User rejected the request' },
        },
      });
    },
    [respondSessionRequest]
  );

  const handleSessionRequest = useCallback(
    async (rawEvent: unknown) => {
      const event = rawEvent as SessionRequestEvent & { session: SessionTypes.Struct };
      const method = event.params?.request?.method;
      const params = event.params?.request?.params;

      if (method === 'stellar_signAuthEntry') {
        try {
          const { request, parsed } = parseSignAuthEntryRequest({
            id: event.id,
            topic: event.topic,
            params,
            session: event.session,
          });
          setParsedAuthEntry(parsed);
          setPendingSignAuthEntry(request);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unparseable auth entry XDR';
          await walletKit.respondSessionRequest({
            topic: event.topic,
            response: {
              id: event.id,
              jsonrpc: '2.0',
              error: { code: 4001, message },
            },
          });
        }
        return;
      }

      if (method === 'stellar_signXDR' || method === 'stellar_signAndSubmitXDR') {
        const request = parseSignXdrRequest({
          id: event.id,
          topic: event.topic,
          method,
          params: params as SignXdrRequest['params'],
          session: event.session ?? getAllSessions()[event.topic],
        });
        setSignXdrStatus('pending');
        setPendingSignXdr(request);
        return;
      }

      const session = event.session ?? getAllSessions()[event.topic];
      if (!session) {
        await respondSessionRequest({
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
        await respondSessionRequest({
          topic: event.topic,
          response: { id: event.id, jsonrpc: '2.0', result },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed';
        await respondSessionRequest({
          topic: event.topic,
          response: {
            id: event.id,
            jsonrpc: '2.0',
            error: { code: 4001, message },
          },
        });
      }
    },
    [handlers, getAllSessions, respondSessionRequest]
  );

  useEffect(() => {
    if (!walletKit || !isInitialized) return;

    const handleSessionProposal = (...args: unknown[]) => {
      setPendingProposal(args[0] as SessionProposal);
    };

    walletKit.on('session_proposal', handleSessionProposal);
    walletKit.on('session_request', handleSessionRequest);
    walletKit.on('session_delete', refreshSessions);

    return () => {
      walletKit.off('session_proposal', handleSessionProposal);
      walletKit.off('session_request', handleSessionRequest);
      walletKit.off('session_delete', refreshSessions);
    };
  }, [walletKit, isInitialized, handleSessionRequest, refreshSessions, getAllSessions]);

  useEffect(() => {
    if (!isInitialized || typeof __DEV__ === 'undefined' || !__DEV__) {
      return;
    }

    let subscription: { remove: () => void } | undefined;

    void import('react-native')
      .then(({ DeviceEventEmitter }) => {
        subscription = DeviceEventEmitter.addListener(
          'MockWalletConnectRequest',
          (payload: string) => {
            try {
              const parsed = JSON.parse(payload) as {
                method: string;
                params: unknown;
              };
              const sessions = getAllSessions();
              const topic = Object.keys(sessions)[0];
              if (!topic) {
                return;
              }

              void handleSessionRequest({
                id: Date.now(),
                topic,
                session: sessions[topic],
                params: {
                  request: {
                    method: parsed.method,
                    params: parsed.params,
                  },
                },
              });
            } catch (error) {
              console.error('Failed to handle mock WalletConnect request:', error);
            }
          }
        );
      })
      .catch(() => undefined);

    return () => {
      subscription?.remove();
    };
  }, [isInitialized, handleSessionRequest, getAllSessions]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const subscription = subscribeToWalletConnectDeepLinks(({ uri }: { uri: string }) => {
      void pair(uri);
    });

    return () => subscription.remove();
  }, [isInitialized, pair]);

  useEffect(() => {
    if (!isInitialized || typeof __DEV__ === 'undefined' || !__DEV__) {
      return;
    }

    let subscription: { remove: () => void } | undefined;

    const dispatchMockRequest = (request: { method: string; params: unknown }) => {
      const sessions = getAllSessions();
      const topic = Object.keys(sessions)[0];
      if (!topic) {
        return;
      }

      void handleSessionRequest({
        id: Date.now(),
        topic,
        session: sessions[topic],
        params: {
          request: {
            method: request.method,
            params: request.params,
          },
        },
      });
    };

    void import('react-native')
      .then(({ Linking }) => {
        const handleUrl = (url: string | null) => {
          if (!url || !isDevMockWalletConnectDeepLink(url)) {
            return;
          }

          const request = parseDevMockWalletConnectDeepLink(url);
          if (request) {
            dispatchMockRequest(request);
          }
        };

        void Linking.getInitialURL().then(handleUrl);
        subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
      })
      .catch(() => undefined);

    return () => subscription?.remove();
  }, [getAllSessions, handleSessionRequest, isInitialized]);

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

    const session = getAllSessions()[pendingSignAuthEntry.topic];
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
      await respondSessionRequest({
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

  const handleSignXdrApprove = async () => {
    if (!pendingSignXdr || !walletKit) return;

    const session = getAllSessions()[pendingSignXdr.topic];
    if (!session) {
      await respondSessionRequest({
        topic: pendingSignXdr.topic,
        response: {
          id: pendingSignXdr.id,
          jsonrpc: '2.0',
          error: { code: 4100, message: 'Session not found' },
        },
      });
      setPendingSignXdr(null);
      return;
    }

    try {
      const result = await handleStellarRpcRequest(
        pendingSignXdr.method,
        pendingSignXdr.params,
        session,
        handlers
      );

      await respondSessionRequest({
        topic: pendingSignXdr.topic,
        response: {
          id: pendingSignXdr.id,
          jsonrpc: '2.0',
          result,
        },
      });

      setSignXdrStatus('success');
      setTimeout(() => {
        setPendingSignXdr(null);
        setSignXdrStatus('pending');
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed';
      await respondSessionRequest({
        topic: pendingSignXdr.topic,
        response: {
          id: pendingSignXdr.id,
          jsonrpc: '2.0',
          error: { code: 4001, message },
        },
      });
      setPendingSignXdr(null);
    }
  };

  const handleSignXdrReject = async () => {
    if (!pendingSignXdr || !walletKit) return;

    await respondSessionRequest({
      topic: pendingSignXdr.topic,
      response: {
        id: pendingSignXdr.id,
        jsonrpc: '2.0',
        error: { code: 4001, message: 'User rejected the request' },
      },
    });
    setPendingSignXdr(null);
    setSignXdrStatus('pending');
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
      {pendingSignXdr && (
        <SignXdrApprovalSheet
          request={pendingSignXdr}
          status={signXdrStatus}
          onApprove={handleSignXdrApprove}
          onReject={handleSignXdrReject}
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
