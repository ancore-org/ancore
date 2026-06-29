// @ts-nocheck
import { useEffect, useRef, useState } from 'react';

import { useWalletConnect } from '../../providers/WalletKitProvider';

export type WCPairingStatus = 'pairing' | 'awaiting_proposal' | 'proposal_received' | 'error';

export interface WCPairingScreenProps {
  /** WalletConnect pairing URI from the `ancore://wc?uri=` deep link. */
  uri: string;
  onSessionProposal?: () => void;
  onError?: (error: Error) => void;
}

export const WCPairingScreen = ({ uri, onSessionProposal, onError }: WCPairingScreenProps) => {
  const { pair, walletKit, isInitialized } = useWalletConnect();
  const [status, setStatus] = useState<WCPairingStatus>('pairing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedPairing = useRef(false);

  useEffect(() => {
    if (!isInitialized || !walletKit || hasStartedPairing.current) {
      return;
    }

    hasStartedPairing.current = true;

    const handleSessionProposal = () => {
      setStatus('proposal_received');
      onSessionProposal?.();
    };

    walletKit.on('session_proposal', handleSessionProposal);

    setStatus('pairing');
    void pair(uri)
      .then(() => {
        setStatus('awaiting_proposal');
      })
      .catch((error: unknown) => {
        const pairingError = error instanceof Error ? error : new Error('Pairing failed');
        setStatus('error');
        setErrorMessage(pairingError.message);
        onError?.(pairingError);
      });

    return () => {
      walletKit.off('session_proposal', handleSessionProposal);
    };
  }, [isInitialized, walletKit, uri, pair, onSessionProposal, onError]);

  if (status === 'error') {
    return (
      <section aria-label="WalletConnect pairing">
        <p role="alert">{errorMessage ?? 'Pairing failed'}</p>
      </section>
    );
  }

  if (status === 'proposal_received') {
    return (
      <section aria-label="WalletConnect pairing">
        <p>Session proposal received</p>
      </section>
    );
  }

  return (
    <section aria-label="WalletConnect pairing">
      <p aria-live="polite" aria-busy="true">
        {status === 'pairing' ? 'Connecting to dApp…' : 'Waiting for session proposal…'}
      </p>
    </section>
  );
};
