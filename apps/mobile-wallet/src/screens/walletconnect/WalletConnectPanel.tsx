import { useCallback, useEffect, useRef, useState } from 'react';

import { useWalletConnect } from '../../providers/WalletKitProvider';

interface WalletConnectPanelProps {
  onPairingUri?: (uri: string) => void;
}

export function WalletConnectPanel({ onPairingUri }: WalletConnectPanelProps = {}) {
  const { pair, sessions, isInitialized } = useWalletConnect();
  const [showInput, setShowInput] = useState(false);
  const [uri, setUri] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
    }
  }, [showInput]);

  const handlePair = useCallback(
    async (pairingUri: string) => {
      const trimmed = pairingUri.trim();
      if (!trimmed) {
        return;
      }

      setError(null);
      setIsPairing(true);
      onPairingUri?.(trimmed);

      try {
        await pair(trimmed);
        setUri('');
        setShowInput(false);
      } catch (pairingError) {
        const message = pairingError instanceof Error ? pairingError.message : 'Pairing failed';
        setError(message);
      } finally {
        setIsPairing(false);
      }
    },
    [onPairingUri, pair]
  );

  const handleUriChange = (value: string) => {
    setUri(value);

    if (value.trim().startsWith('wc:')) {
      void handlePair(value);
    }
  };

  if (!isInitialized) {
    return (
      <section aria-label="WalletConnect">
        <p aria-live="polite">Initializing WalletConnect…</p>
      </section>
    );
  }

  if (sessions.length > 0) {
    return (
      <section aria-label="WalletConnect">
        <h2>WalletConnect</h2>
        <p>Session Active</p>
        <p>
          {sessions.length} connected dApp{sessions.length === 1 ? '' : 's'}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="WalletConnect">
      <h2>WalletConnect</h2>
      {!showInput ? (
        <button type="button" onClick={() => setShowInput(true)}>
          Scan QR
        </button>
      ) : (
        <div>
          <label htmlFor="wc-pairing-uri">WalletConnect URI</label>
          <input
            id="wc-pairing-uri"
            ref={inputRef}
            type="text"
            value={uri}
            onChange={(event) => handleUriChange(event.target.value)}
            placeholder="wc:..."
            aria-label="WalletConnect URI"
            disabled={isPairing}
          />
          {isPairing ? <p aria-live="polite">Connecting…</p> : null}
        </div>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
