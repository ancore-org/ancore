import { useCallback, useEffect, useRef, useState } from 'react';

export interface WalletConnectionState {
  /** Whether the dApp is currently connected to the extension. */
  connected: boolean;
  /** Smart account C-address. */
  smartAccountId: string | null;
  /** Owner G-address derived from mnemonic. */
  ownerPublicKey: string | null;
  /** Whether a connect/disconnect operation is in progress. */
  connecting: boolean;
  /** Error message from last connection attempt. */
  error: string | null;
  /** Whether the wallet extension is installed. */
  extensionInstalled: boolean;
}

interface UseWalletConnectionOptions {
  /** Auto-check connection on mount. Default: true. */
  autoCheck?: boolean;
}

/**
 * Hook wrapping @ancore/wallet-api for dApp ↔ extension connection management.
 * Provides connect, disconnect, and connection state.
 */
export function useWalletConnection(options: UseWalletConnectionOptions = {}) {
  const { autoCheck = true } = options;

  const [state, setState] = useState<WalletConnectionState>({
    connected: false,
    smartAccountId: null,
    ownerPublicKey: null,
    connecting: false,
    error: null,
    extensionInstalled: false,
  });

  // A dynamic import plus two awaited calls gives connect/checkConnection
  // plenty of time to still be in flight when the component unmounts (a route
  // change, a test's renderHook cleanup). Without this guard, the eventual
  // setState runs against a DOM that may already be gone.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const walletApi = await import('@ancore/wallet-api');
      const connected = await walletApi.isConnected();

      if (connected) {
        const addressResult = await walletApi.getAddress();
        if (!mountedRef.current) return;
        setState({
          connected: true,
          smartAccountId: addressResult.smartAccountId,
          ownerPublicKey: addressResult.ownerPublicKey ?? null,
          connecting: false,
          error: null,
          extensionInstalled: true,
        });
      } else {
        if (!mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          connected: false,
          smartAccountId: null,
          ownerPublicKey: null,
          extensionInstalled: true,
        }));
      }
    } catch {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        connected: false,
        extensionInstalled: false,
      }));
    }
  }, []);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, connecting: true, error: null }));

    try {
      const walletApi = await import('@ancore/wallet-api');
      const smartAccountId = await walletApi.connect();
      const addressResult = await walletApi.getAddress();

      if (!mountedRef.current) return;
      setState({
        connected: true,
        smartAccountId,
        ownerPublicKey: addressResult.ownerPublicKey ?? null,
        connecting: false,
        error: null,
        extensionInstalled: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to wallet';
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        connecting: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      connected: false,
      smartAccountId: null,
      ownerPublicKey: null,
      connecting: false,
      error: null,
      extensionInstalled: state.extensionInstalled,
    });
  }, [state.extensionInstalled]);

  useEffect(() => {
    if (autoCheck) {
      void checkConnection();
    }
  }, [autoCheck, checkConnection]);

  return {
    ...state,
    connect,
    disconnect,
    refresh: checkConnection,
  };
}
