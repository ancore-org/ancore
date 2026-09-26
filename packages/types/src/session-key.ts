/**
 * Session key types matching Soroban contract session key structure.
 */

import { z } from 'zod';

/**
 * Permission types allowed for a session key.
 *
 * This is the single canonical representation of a session permission. The
 * values are **contract permission indices**, not bit flags: they are sent
 * verbatim as the contract's `Vec<u32>` permissions and must stay numerically
 * in sync with `VALID_PERMISSIONS` in `contracts/account/src/validation.rs`.
 *
 * | This enum        | Contract constant           | Value |
 * | ---------------- | --------------------------- | ----- |
 * | SEND_PAYMENT     | PERMISSION_SEND_PAYMENT     | 0     |
 * | MANAGE_DATA      | PERMISSION_EXECUTE          | 1     |
 * | INVOKE_CONTRACT  | PERMISSION_INVOKE_CONTRACT  | 2     |
 *
 * Note the name divergence on value `1`: the contract calls it `EXECUTE`
 * (it gates `execute()` authorization), while this enum has historically
 * called it `MANAGE_DATA`. The *value* is what crosses the contract boundary,
 * so the two are compatible; the name is kept as-is to avoid a breaking
 * rename of a published enum member.
 *
 * For bitmask-based UI state, do not re-derive bits here — use `PERM_BITS`
 * and the helpers in `@ancore/account-abstraction`, which compute bits from
 * these indices (`1 << index`) and convert back to the contract `Vec<u32>`.
 */
export enum SessionPermission {
  SEND_PAYMENT = 0,
  MANAGE_DATA = 1,
  INVOKE_CONTRACT = 2,
}

/**
 * SessionKey describes a delegated key with limited permissions and expiration.
 * Soroban mapping example:
 * - `public_key` -> G... address
 * - `permissions` -> Vec<u32> where each u32 maps to a permission enum
 * - `expires_at` -> u64 expiration timestamp
 */
export interface SessionKey {
  publicKey: string;
  permissions: SessionPermission[];
  expiresAt: number; // unix ms
  label?: string;
}

export const SessionKeySchema = z.object({
  publicKey: z.string().regex(/^G[A-Z0-9]{55}$/),
  permissions: z.array(z.nativeEnum(SessionPermission)),
  expiresAt: z.number().int().positive(),
  label: z.string().optional(),
});

export type SessionKeyFromSchema = z.infer<typeof SessionKeySchema>;
