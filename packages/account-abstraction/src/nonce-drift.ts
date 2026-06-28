/**
 * Nonce drift detection helper for account abstraction retry safety.
 *
 * Compares an expected nonce against the value observed on-chain and
 * returns a deterministic classification that callers can use to decide
 * whether to retry, resync, or abort.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Classification of the relationship between an expected nonce and the
 * nonce observed on-chain.
 */
export enum NonceDriftKind {
  /** Expected and observed nonces are identical — safe to submit. */
  ExactMatch = 'ExactMatch',

  /**
   * The observed nonce is ahead of the expected nonce, meaning a previous
   * transaction already incremented it. The operation was likely already
   * processed.
   */
  ObservedAhead = 'ObservedAhead',

  /**
   * The observed nonce is behind the expected nonce, suggesting the chain
   * has not yet processed a prior transaction or the expected nonce was
   * incremented locally without an on-chain confirmation.
   */
  ObservedBehind = 'ObservedBehind',

  /**
   * The absolute difference between expected and observed exceeds the
   * configured `excessiveDriftThreshold`. Manual intervention is required
   * rather than automatic retry.
   */
  ExcessiveDrift = 'ExcessiveDrift',

  /**
   * One or both nonce inputs are invalid (negative, non-integer, NaN,
   * or infinite).
   */
  InvalidNonceState = 'InvalidNonceState',
}

/** Retry guidance associated with each drift kind. */
export const NONCE_DRIFT_RETRY_GUIDANCE: Record<NonceDriftKind, string> = {
  [NonceDriftKind.ExactMatch]: 'Nonces match — proceed with submission.',
  [NonceDriftKind.ObservedAhead]:
    'Transaction may have already been processed. Verify on-chain before retrying.',
  [NonceDriftKind.ObservedBehind]:
    'Chain nonce is behind expected. Wait for prior transactions to confirm, then resync.',
  [NonceDriftKind.ExcessiveDrift]:
    'Drift exceeds safe threshold. Resync the local nonce from the chain before retrying.',
  [NonceDriftKind.InvalidNonceState]:
    'One or both nonce values are invalid. Validate inputs before retrying.',
};

/** Result returned by `detectNonceDrift`. */
export interface NonceDriftResult {
  /** Classification of the drift. */
  kind: NonceDriftKind;
  /** Signed delta: observed − expected. Positive = observed is ahead. */
  delta: number;
  /** Human-readable message describing the drift and recommended action. */
  message: string;
  /** Actionable retry guidance for the caller. */
  retryGuidance: string;
}

/** Options for `detectNonceDrift`. */
export interface NonceDriftOptions {
  /**
   * Absolute delta above which drift is classified as ExcessiveDrift rather
   * than ObservedAhead / ObservedBehind.
   *
   * @default 10
   */
  excessiveDriftThreshold?: number;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Returns `true` if `n` is a safe, non-negative integer (finite, not NaN,
 * integer-valued, and ≥ 0).
 */
export function isValidNonce(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

/**
 * Detect and classify the drift between an expected nonce and the nonce
 * currently observed on-chain.
 *
 * The function is **pure** (no side effects, no I/O) and therefore fully
 * deterministic — identical inputs always produce identical outputs.
 *
 * @param expected  - The nonce the caller believes is current.
 * @param observed  - The nonce read from the chain / contract state.
 * @param options   - Optional configuration.
 * @returns A `NonceDriftResult` with classification, delta, message, and
 *          retry guidance.
 *
 * @example
 * ```ts
 * const result = detectNonceDrift(5, 5);
 * // { kind: NonceDriftKind.ExactMatch, delta: 0, ... }
 *
 * const stale = detectNonceDrift(3, 5);
 * // { kind: NonceDriftKind.ObservedAhead, delta: 2, ... }
 * ```
 */
export function detectNonceDrift(
  expected: number,
  observed: number,
  options?: NonceDriftOptions
): NonceDriftResult {
  const threshold =
    options?.excessiveDriftThreshold !== undefined ? options.excessiveDriftThreshold : 10;

  // Validate inputs first.
  if (!isValidNonce(expected) || !isValidNonce(observed)) {
    return {
      kind: NonceDriftKind.InvalidNonceState,
      delta: NaN,
      message: `Invalid nonce input — expected: ${expected}, observed: ${observed}. Both must be non-negative integers.`,
      retryGuidance: NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.InvalidNonceState],
    };
  }

  const delta = observed - expected;
  const absDelta = Math.abs(delta);

  if (delta === 0) {
    return {
      kind: NonceDriftKind.ExactMatch,
      delta: 0,
      message: `Nonces match (expected=${expected}, observed=${observed}).`,
      retryGuidance: NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ExactMatch],
    };
  }

  if (absDelta > threshold) {
    return {
      kind: NonceDriftKind.ExcessiveDrift,
      delta,
      message:
        `Excessive nonce drift detected — expected=${expected}, observed=${observed}, ` +
        `delta=${delta} (threshold=${threshold}).`,
      retryGuidance: NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ExcessiveDrift],
    };
  }

  if (delta > 0) {
    return {
      kind: NonceDriftKind.ObservedAhead,
      delta,
      message:
        `Observed nonce (${observed}) is ahead of expected (${expected}) by ${delta}. ` +
        `A prior transaction may already be confirmed.`,
      retryGuidance: NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ObservedAhead],
    };
  }

  // delta < 0
  return {
    kind: NonceDriftKind.ObservedBehind,
    delta,
    message:
      `Observed nonce (${observed}) is behind expected (${expected}) by ${absDelta}. ` +
      `The chain has not yet processed a prior transaction.`,
    retryGuidance: NONCE_DRIFT_RETRY_GUIDANCE[NonceDriftKind.ObservedBehind],
  };
}

// ── fetchAndIncrementNonce (#862) ─────────────────────────────────────────────

/** Fetches the on-chain nonce for an account. */
export type NonceFetcher = (accountAddress: string) => Promise<number>;

/** Options for `fetchAndIncrementNonce`. */
export interface FetchAndIncrementNonceOptions {
  /**
   * Maximum number of retries on `InvalidNonce` errors before giving up.
   * @default 3
   */
  maxRetries?: number;
  /**
   * Base delay in milliseconds between retries (doubles each attempt).
   * @default 200
   */
  baseDelayMs?: number;
}

/**
 * Fetch the current on-chain nonce for `accountAddress` and return the next
 * nonce to use (`observed + 1`).
 *
 * Retries automatically when the underlying fetcher throws an error whose
 * message contains `"InvalidNonce"`, applying exponential backoff.  All
 * other errors are rethrown immediately.
 *
 * @param accountAddress - The account whose nonce to fetch.
 * @param fetchNonce     - Async function that reads the current nonce from chain.
 * @param options        - Optional retry configuration.
 * @returns The next nonce value to include in the transaction (`observed + 1`).
 *
 * @example
 * ```ts
 * const nonce = await fetchAndIncrementNonce(
 *   'G...',
 *   (addr) => sorobanRpc.getAccount(addr).then(a => a.sequenceNumber),
 * );
 * ```
 */
export async function fetchAndIncrementNonce(
  accountAddress: string,
  fetchNonce: NonceFetcher,
  options?: FetchAndIncrementNonceOptions
): Promise<number> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 200;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const current = await fetchNonce(accountAddress);

      if (!isValidNonce(current)) {
        throw new Error(
          `fetchAndIncrementNonce: fetcher returned invalid nonce ${current} for ${accountAddress}`
        );
      }

      return current + 1;
    } catch (err) {
      lastError = err;

      const isInvalidNonce = err instanceof Error && err.message.includes('InvalidNonce');

      if (!isInvalidNonce || attempt === maxRetries) {
        throw err;
      }

      // Exponential backoff before retry
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
