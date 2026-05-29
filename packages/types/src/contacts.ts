/**
 * Shared contact and favorites types for Ancore recipient management.
 * Used by extension-wallet and web-dashboard.
 */

import { z } from 'zod';

// ── Zod schemas ────────────────────────────────────────────────────────────

/** Stellar public key: G + 55 uppercase alphanumeric chars */
export const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar address (G...)');

/**
 * Alias constraints:
 * - 1–32 characters
 * - Alphanumeric, spaces, hyphens, and underscores only
 */
export const contactAliasSchema = z
  .string()
  .min(1, 'Alias must not be empty')
  .max(32, 'Alias must be ≤ 32 characters')
  .regex(
    /^[a-zA-Z0-9 _-]+$/,
    'Alias may only contain letters, numbers, spaces, hyphens, or underscores'
  );

/** Schema for a single saved contact. */
export const ContactSchema = z.object({
  /** Stable, client-generated identifier (UUID v4 recommended). */
  id: z.string().min(1),
  /** Human-readable label for the contact. Must be unique per wallet. */
  alias: contactAliasSchema,
  /** Stellar address of the recipient. */
  address: stellarAddressSchema,
  /** Whether this contact is marked as a favorite. */
  isFavorite: z.boolean().default(false),
  /** Unix timestamp (ms) when the contact was created. */
  createdAt: z.number().int().positive(),
  /** Unix timestamp (ms) of the last edit, or undefined if never edited. */
  updatedAt: z.number().int().positive().optional(),
});

export type Contact = z.infer<typeof ContactSchema>;

/** Schema for the payload accepted by addContact / updateContact. */
export const ContactPayloadSchema = z.object({
  alias: contactAliasSchema,
  address: stellarAddressSchema,
  isFavorite: z.boolean().optional(),
});

export type ContactPayload = z.infer<typeof ContactPayloadSchema>;
