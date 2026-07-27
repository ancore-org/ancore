import { useEffect, useRef, useState } from 'react';
import { createStellarClient } from '@ancore/stellar';
import { Operation, Asset, TransactionBuilder, Account } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeeEstimateState {
  /** Estimated fee in XLM. */
  fee: string;
  /** Minimum account balance needed. */
  minBalance: string;
  /** Whether estimation is in progress. */
  loading: boolean;
  /** Error message if estimation failed. */
  error: string | null;
}

interface UseSendFeeEstimateOptions {
  /** Network to query. Default: 'testnet'. */
  network?: 'testnet' | 'mainnet' | 'futurenet' | 'local';
  /** Debounce delay in ms. Default: 500. */
  debounceMs?: number;
  /** Disable estimation. Default: false. */
  disabled?: boolean;
}

const NETWORK_PASSPHRASE: Record<string, string> = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
  local: 'Standalone Network ; February 2017',
};

const INITIAL_STATE: FeeEstimateState = {
  fee: '0.0000100',
  minBalance: '0.0050100',
  loading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Estimates network fee for a payment transaction via Stellar simulation.
 * Debounces rapid input changes and aborts stale requests.
 */
export function useSendFeeEstimate(
  recipient: string,
  amount: string,
  options: UseSendFeeEstimateOptions = {}
): FeeEstimateState {
  const { network = 'testnet', debounceMs = 500, disabled = false } = options;

  const [state, setState] = useState<FeeEstimateState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    cancelledRef.current = true;

    if (disabled || !recipient || !amount || Number(amount) <= 0) {
      setState(INITIAL_STATE);
      return;
    }

    cancelledRef.current = false;

    timerRef.current = setTimeout(() => {
      if (cancelledRef.current) return;

      const estimate = async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
          const client = createStellarClient(network);
          const passphrase = NETWORK_PASSPHRASE[network] ?? NETWORK_PASSPHRASE.testnet;

          const dummyAccount = new Account(
            'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            '0'
          );
          const txBuilder = new TransactionBuilder(dummyAccount, {
            fee: '100000',
            networkPassphrase: passphrase,
          });
          txBuilder.addOperation(
            Operation.payment({
              destination: recipient,
              asset: Asset.native(),
              amount,
            })
          );
          const tx = txBuilder.build();

          const result = await client.simulateTransaction(tx.toXDR());

          if (cancelledRef.current) return;

          if ('fee' in result && typeof result.fee === 'string') {
            const feeNum = parseFloat(result.fee) || 0;
            setState({
              fee: result.fee,
              minBalance: (0.5 + feeNum).toFixed(7),
              loading: false,
              error: null,
            });
          } else {
            const errorMsg =
              'error' in result && typeof result.error === 'string'
                ? result.error
                : 'Fee estimation failed';
            setState({
              fee: '0.0000100',
              minBalance: '0.0050100',
              loading: false,
              error: errorMsg,
            });
          }
        } catch (err) {
          if (cancelledRef.current) return;
          setState({
            fee: '0.0000100',
            minBalance: '0.0050100',
            loading: false,
            error: err instanceof Error ? err.message : 'Fee estimation failed',
          });
        }
      };

      void estimate();
    }, debounceMs);

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [amount, debounceMs, disabled, network, recipient]);

  return state;
}
