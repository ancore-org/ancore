/**
 * Policy parameters for dApp-initiated session key requests (issue #873).
 */

import { z } from 'zod';

/**
 * Zod schema for SessionKeyPolicy runtime validation.
 * - expiresAt must be a positive integer (future Unix timestamp in ms)
 * - permissions must be a non-negative integer bitmask
 * - allowedContracts is an optional array of C-address strings
 * - maxAmountPerCall is an optional numeric string
 */
export const SessionKeyPolicySchema = z.object({
  expiresAt: z
    .number()
    .int()
    .positive('expiresAt must be a positive integer (Unix timestamp in ms)'),
  permissions: z.number().int().nonnegative('permissions must be a non-negative integer bitmask'),
  allowedContracts: z
    .array(z.string().regex(/^C[A-Z0-9]{55}$/, 'Invalid contract C-address'))
    .optional(),
  maxAmountPerCall: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'maxAmountPerCall must be a numeric string')
    .optional(),
});

export type SessionKeyPolicyFromSchema = z.infer<typeof SessionKeyPolicySchema>;

/** Policy parameters for dApp-initiated session key requests (issue #873). */
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
