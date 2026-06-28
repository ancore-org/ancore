import { z } from 'zod';

// ─── Shared Field Schemas ────────────────────────────────────────────────────

/** Stellar public key: G + 55 chars, base32-encoded */
const stellarPublicKeySchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar public key (G...)');

/** Ed25519 hex-encoded 32-byte public key */
const sessionPublicKeySchema = z
  .string()
  .length(64, 'Must be a 64-char hex-encoded Ed25519 public key')
  .regex(/^[0-9a-fA-F]+$/, 'Must be hex-encoded');

/** Ed25519 hex-encoded 64-byte signature */
const signatureSchema = z
  .string()
  .length(128, 'Must be a 128-char hex-encoded Ed25519 signature')
  .regex(/^[0-9a-fA-F]+$/, 'Must be hex-encoded');

/** Unix timestamp in seconds */
const unixTimestampSchema = z.number().int().positive('Timestamp must be a positive integer');

/** Ledger sequence or u64-range nonce */
const nonceSchema = z
  .number()
  .int()
  .nonnegative('Nonce must be a non-negative integer');

// ─── /relay/execute ──────────────────────────────────────────────────────────

/**
 * POST /relay/execute
 * Submit a signed transaction for relay submission to the Ancore account contract.
 */
export const relayExecuteRequestSchema = z.object({
  /** Target account contract address */
  accountAddress: stellarPublicKeySchema,
  /** Destination contract address */
  to: stellarPublicKeySchema,
  /** Function to invoke on the target contract */
  functionName: z
    .string()
    .min(1, 'functionName must not be empty')
    .max(32, 'functionName must be ≤ 32 chars'),
  /** Serialised XDR arguments (base64-encoded) */
  args: z.array(z.string()).default([]),
  /** Replay-protection nonce */
  nonce: nonceSchema,
  /** Caller type: owner or session key */
  callerType: z.enum(['owner', 'session_key']),
  /** Session public key (required when callerType = session_key) */
  sessionPublicKey: sessionPublicKeySchema.optional(),
  /** Ed25519 signature over canonical payload */
  signature: signatureSchema.optional(),
  /** Canonical signing payload (hex-encoded) */
  signaturePayload: z
    .string()
    .regex(/^[0-9a-fA-F]*$/, 'Must be hex-encoded')
    .optional(),
});

export type RelayExecuteRequest = z.infer<typeof relayExecuteRequestSchema>;

// ─── /relay/session-key ──────────────────────────────────────────────────────

/**
 * POST /relay/session-key
 * Add or refresh a session key on behalf of the account owner.
 */
export const relayAddSessionKeyRequestSchema = z.object({
  /** Account contract address */
  accountAddress: stellarPublicKeySchema,
  /** Ed25519 session public key to register */
  sessionPublicKey: sessionPublicKeySchema,
  /** Expiration timestamp (seconds since epoch) */
  expiresAt: unixTimestampSchema,
  /** Permission bits (bitmask) */
  permissions: z.array(z.number().int().nonnegative()).default([]),
  /** Owner signature authorising the operation */
  signature: signatureSchema,
  /** Canonical signing payload */
  signaturePayload: z
    .string()
    .regex(/^[0-9a-fA-F]+$/, 'Must be hex-encoded'),
});

export type RelayAddSessionKeyRequest = z.infer<typeof relayAddSessionKeyRequestSchema>;

// ─── /relay/revoke-session-key ───────────────────────────────────────────────

/**
 * POST /relay/revoke-session-key
 * Revoke an existing session key.
 */
export const relayRevokeSessionKeyRequestSchema = z.object({
  accountAddress: stellarPublicKeySchema,
  sessionPublicKey: sessionPublicKeySchema,
  signature: signatureSchema,
  signaturePayload: z
    .string()
    .regex(/^[0-9a-fA-F]+$/, 'Must be hex-encoded'),
});

export type RelayRevokeSessionKeyRequest = z.infer<typeof relayRevokeSessionKeyRequestSchema>;

// ─── Typed error response ─────────────────────────────────────────────────────

export interface ValidationErrorResponse {
  error: 'VALIDATION_ERROR';
  message: string;
  details: Array<{ field: string; message: string }>;
}
