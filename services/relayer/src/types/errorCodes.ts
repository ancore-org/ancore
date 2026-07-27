/**
 * Stable, machine-readable error codes returned by the Relayer API.
 *
 * Every non-2xx relay response carries `error.code` drawn from this enum. The
 * codes are part of the public API contract: clients switch on `error.code`
 * and must never parse `error.message`, which is free text and may change
 * between releases without notice.
 *
 * Adding a code is a backwards-compatible change; renaming or removing one is
 * not. Clients should treat an unrecognised code as `INTERNAL_ERROR`.
 */
export const RelayErrorCodes = {
  /** Request signature failed Ed25519 verification, or the session key is malformed/unknown. */
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  /** The session key exists on chain but is past its expiry. */
  SESSION_KEY_EXPIRED: 'SESSION_KEY_EXPIRED',
  /** The nonce is negative, or has already been consumed by this session key. */
  NONCE_REPLAY: 'NONCE_REPLAY',
  /** Soroban resource budget (fee, CPU, or memory) exhausted. */
  GAS_LIMIT_EXCEEDED: 'GAS_LIMIT_EXCEEDED',
  /** Transaction simulation or host-function invocation failed. */
  SIMULATION_FAILED: 'SIMULATION_FAILED',
  /** A transfer policy (daily limit, step-up threshold, allowlist) rejected the request. */
  POLICY_DENIED: 'POLICY_DENIED',
  /** The upstream Soroban RPC / Horizon endpoint is unreachable or unhealthy. */
  RPC_DOWN: 'RPC_DOWN',
  /** The caller is not authenticated or lacks permission for this operation. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Unclassified server-side failure. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /**
   * @deprecated Emitted by relayer <= 0.1.0 for transfer-limit denials.
   * Superseded by {@link RelayErrorCodes.POLICY_DENIED}; retained so existing
   * clients keep type-checking. The service no longer produces this code.
   */
  TRANSFER_LIMIT_EXCEEDED: 'TRANSFER_LIMIT_EXCEEDED',
} as const;

/** Union of every code the relayer may return in `error.code`. */
export type RelayErrorCode = (typeof RelayErrorCodes)[keyof typeof RelayErrorCodes];

/** Every code as a frozen array — useful for schema generation and contract tests. */
export const RELAY_ERROR_CODES: readonly RelayErrorCode[] = Object.freeze(
  Object.values(RelayErrorCodes)
);

/** Narrow an unknown value to a {@link RelayErrorCode}. */
export function isRelayErrorCode(value: unknown): value is RelayErrorCode {
  return typeof value === 'string' && (RELAY_ERROR_CODES as readonly string[]).includes(value);
}
