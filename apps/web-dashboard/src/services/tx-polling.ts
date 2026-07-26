// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransactionPollStatus =
  | { status: 'confirmed'; ledger: number; timestamp: number }
  | { status: 'pending' }
  | { status: 'failed'; error?: string };

export interface PollOptions {
  /** Maximum polling attempts before giving up. Default: 60. */
  maxAttempts?: number;
  /** Interval between polls in ms. Default: 5000. */
  intervalMs?: number;
  /** Network for Horizon queries. Default: 'testnet'. */
  network?: 'testnet' | 'mainnet' | 'futurenet' | 'local';
  /** Custom fetch for relayer status polling. */
  fetchImpl?: typeof fetch;
  /** Base URL for relayer status polling. */
  relayerBaseUrl?: string;
  /** Auth token for relayer requests. */
  getAuthToken?: () => string | Promise<string>;
  /** Whether this is a relayer-originated transaction. */
  isRelayerJob?: boolean;
}

export interface TransactionPollResult {
  status: TransactionPollStatus;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Horizon-based polling (extension wallet-api path)
// ---------------------------------------------------------------------------

async function pollHorizonTransaction(
  hash: string,
  options: Required<Pick<PollOptions, 'network'>> & PollOptions
): Promise<TransactionPollResult> {
  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const horizonResult = await checkHorizonStatus(hash, options.network);
      if (horizonResult.status === 'confirmed') {
        return { status: horizonResult, attempts: attempt + 1 };
      }
      if (horizonResult.status === 'failed') {
        return { status: horizonResult, attempts: attempt + 1 };
      }
    } catch {
      // Transaction not found yet — it's still pending
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  return {
    status:
      maxAttempts <= 1
        ? { status: 'pending' }
        : { status: 'failed', error: 'Transaction polling timed out' },
    attempts: maxAttempts,
  };
}

async function checkHorizonStatus(hash: string, network: string): Promise<TransactionPollStatus> {
  const networkUrls: Record<string, string> = {
    testnet: 'https://horizon-testnet.stellar.org',
    mainnet: 'https://horizon.stellar.org',
    futurenet: 'https://horizon-futurenet.stellar.org',
    local: 'http://localhost:8000',
  };

  const baseUrl = networkUrls[network] ?? networkUrls.testnet;
  const response = await fetch(`${baseUrl}/transactions/${hash}`);

  if (response.status === 404) {
    return { status: 'pending' };
  }

  if (!response.ok) {
    return { status: 'pending' };
  }

  const tx = (await response.json()) as {
    hash: string;
    ledger: number;
    created_at: string;
    successful: boolean;
    result_xdr?: string;
  };

  if (tx.successful) {
    return {
      status: 'confirmed',
      ledger: tx.ledger,
      timestamp: new Date(tx.created_at).getTime(),
    };
  }

  return { status: 'failed', error: 'Transaction failed on network' };
}

// ---------------------------------------------------------------------------
// Relayer-based polling
// ---------------------------------------------------------------------------

async function pollRelayerJob(jobId: string, options: PollOptions): Promise<TransactionPollResult> {
  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 5000;
  const baseUrl = options.relayerBaseUrl ?? 'http://localhost:3000';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const token = options.getAuthToken ? await options.getAuthToken() : 'ancore-dashboard-token';

      const response = await fetchImpl(`${baseUrl}/relay/status/${encodeURIComponent(jobId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const body = (await response.json()) as {
          status: string;
          txHash?: string;
          ledger?: number;
          error?: string;
        };

        if (body.status === 'confirmed' || body.status === 'success') {
          return {
            status: {
              status: 'confirmed',
              ledger: body.ledger ?? 0,
              timestamp: Date.now(),
            },
            attempts: attempt + 1,
          };
        }

        if (body.status === 'failed') {
          return {
            status: { status: 'failed', error: body.error ?? 'Relayer job failed' },
            attempts: attempt + 1,
          };
        }
        // status is 'pending' or 'processing' — continue polling
      }
    } catch {
      // Network error — continue polling
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  return {
    status:
      maxAttempts <= 1
        ? { status: 'pending' }
        : { status: 'failed', error: 'Relayer job polling timed out' },
    attempts: maxAttempts,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Poll for transaction confirmation.
 * Automatically routes to Horizon (for wallet-api) or relayer status endpoint.
 */
export async function pollTransactionConfirmation(
  hash: string,
  options: PollOptions = {}
): Promise<TransactionPollResult> {
  if (options.isRelayerJob) {
    return pollRelayerJob(hash, options);
  }
  return pollHorizonTransaction(hash, {
    network: 'testnet',
    ...options,
  });
}

/**
 * Create an abortable poll controller.
 * Returns a stop function and a promise that resolves when confirmed/failed.
 */
export function createPollController(
  hash: string,
  options: PollOptions,
  onStatusChange?: (status: TransactionPollStatus) => void
): { stop: () => void; result: Promise<TransactionPollResult> } {
  let stopped = false;

  const result = runPollLoop(hash, options, onStatusChange, () => stopped);

  return {
    stop: () => {
      stopped = true;
    },
    result,
  };
}

async function runPollLoop(
  hash: string,
  options: PollOptions,
  onStatusChange: ((status: TransactionPollStatus) => void) | undefined,
  isStopped: () => boolean
): Promise<TransactionPollResult> {
  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 5000;

  for (let attempt = 0; attempt < maxAttempts && !isStopped(); attempt++) {
    const pollResult = await pollTransactionConfirmation(hash, {
      ...options,
      maxAttempts: 1,
    });

    if (!isStopped()) {
      onStatusChange?.(pollResult.status);
    }

    if (pollResult.status.status === 'confirmed' || pollResult.status.status === 'failed') {
      return pollResult;
    }

    if (attempt < maxAttempts - 1 && !isStopped()) {
      await sleep(intervalMs);
    }
  }

  return {
    status: { status: 'failed', error: 'Polling stopped or timed out' },
    attempts: 0,
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
