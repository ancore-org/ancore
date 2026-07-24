/**
 * Stable machine-readable error codes for relayer failures (#1064).
 * Clients should branch on `code`, never on the human-readable `message`.
 */
export const RelayErrorCodes = {
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  SESSION_KEY_EXPIRED: 'SESSION_KEY_EXPIRED',
  NONCE_REPLAY: 'NONCE_REPLAY',
  GAS_LIMIT_EXCEEDED: 'GAS_LIMIT_EXCEEDED',
  SIMULATION_FAILED: 'SIMULATION_FAILED',
  TRANSFER_LIMIT_EXCEEDED: 'TRANSFER_LIMIT_EXCEEDED',
  POLICY_DENIED: 'POLICY_DENIED',
  RPC_DOWN: 'RPC_DOWN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type RelayErrorCode = (typeof RelayErrorCodes)[keyof typeof RelayErrorCodes];

/** Classify a transfer-policy block: daily-limit breach vs any other policy denial. */
export function transferPolicyBlockCode(
  amount: number,
  todayTotal: number,
  dailyLimit: number
): RelayErrorCode {
  const overDailyLimit =
    Number.isFinite(amount) &&
    Number.isFinite(todayTotal) &&
    amount > 0 &&
    todayTotal >= 0 &&
    todayTotal + amount > dailyLimit;
  return overDailyLimit ? RelayErrorCodes.TRANSFER_LIMIT_EXCEEDED : RelayErrorCodes.POLICY_DENIED;
}
