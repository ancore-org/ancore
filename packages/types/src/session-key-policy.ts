/**
 * Policy parameters for dApp-initiated session key requests (issue #873).
 */
export interface SessionKeyPolicy {
  /** Unix timestamp (ms) when the session key expires. */
  expiresAt: number;
  /** Permission bitmask matching on-chain session key permissions. */
  permissions: number;
  /** Optional contract allowlist (C-addresses). */
  allowedContracts?: string[];
  /** Optional per-call spend cap (stroops / smallest unit string). */
  maxAmountPerCall?: string;
}

export interface RequestSessionKeyResult {
  publicKey: string;
  expiresAt: number;
}
