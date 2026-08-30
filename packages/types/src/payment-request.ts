/**
 * Payment request models for the Ancore payment request flow.
 */

import { z } from 'zod';

// ── Zod schemas ────────────────────────────────────────────────────────────

/** Stellar public key: G + 55 uppercase alphanumeric chars */
const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar public key (G...)');

/** Positive decimal amount held as a string to avoid float precision loss. */
const amountSchema = z
  .string()
  .min(1, 'Amount is required')
  .regex(/^\d+(\.\d+)?$/, 'Amount must be a positive decimal number')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero');

/** Asset code, e.g. "XLM" or "USDC". */
const assetCodeSchema = z
  .string()
  .min(1, 'Asset code is required')
  .max(12, 'Asset code must be ≤ 12 characters')
  .regex(/^[A-Za-z0-9]+$/, 'Asset code must be alphanumeric');

/** Optional human-readable note shown to the payer. */
const noteSchema = z.string().max(200, 'Note must be ≤ 200 characters');

/** Unix timestamp in seconds. */
const unixSecondsSchema = z.number().int().positive();

/** Maximum lifetime of a payment request: 30 days. */
export const MAX_PAYMENT_REQUEST_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Default lifetime of a payment request when no TTL is supplied: 24 hours. */
export const DEFAULT_PAYMENT_REQUEST_TTL_SECONDS = 24 * 60 * 60;

/** Schema for a shareable payment request created by a recipient. */
export const PaymentRequestSchema = z.object({
  /** Unique request identifier (UUID or random hex) */
  id: z.string().min(1),
  /** Stellar public key of the requester */
  requesterAddress: stellarAddressSchema,
  /** Amount requested in the asset's base unit */
  amount: amountSchema,
  /** Asset code (e.g. "XLM", "USDC") */
  assetCode: assetCodeSchema,
  /** Optional human-readable note shown to the payer */
  note: noteSchema.optional(),
  /** Unix timestamp (seconds) after which the request is considered expired */
  expiresAt: unixSecondsSchema,
  /** Unix timestamp (seconds) when the request was created */
  createdAt: unixSecondsSchema,
});

/** A shareable payment request created by a recipient. */
export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

/** Schema for the input accepted when creating a new payment request. */
export const createPaymentRequestSchema = z.object({
  requesterAddress: stellarAddressSchema,
  amount: amountSchema,
  assetCode: assetCodeSchema,
  note: noteSchema.optional(),
  /** Duration in seconds until the request expires (default: 86400 = 24 h) */
  ttlSeconds: z
    .number()
    .int()
    .positive()
    .max(MAX_PAYMENT_REQUEST_TTL_SECONDS, 'TTL must be at most 30 days')
    .optional(),
});

/** Input when creating a new payment request */
export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;

/** Schema for the serialised form embedded in the shareable URL query string. */
export const PaymentRequestPayloadSchema = z.object({
  id: z.string().min(1),
  to: stellarAddressSchema,
  amount: amountSchema,
  asset: assetCodeSchema,
  note: noteSchema.optional(),
  exp: unixSecondsSchema,
});

/** Serialised form embedded in the shareable URL query string */
export type PaymentRequestPayload = z.infer<typeof PaymentRequestPayloadSchema>;
