import { z } from 'zod';
import { assertValidEd25519PublicKey, StrKeyValidationError } from '@ancore/account-abstraction';
import { isUsernameHandle, stellarAddressSchema } from '@ancore/types';

/**
 * Shared validation for the two recipient-bearing intent fields —
 * `payment.destination` and `invoice.recipient` (issue #1210).
 *
 * Both previously accepted any non-empty string, so a hallucinated address, a
 * truncated paste, or a bare name reached the draft (and the risk score) intact.
 *
 * Nothing here re-implements address parsing. An accepted value is either:
 *
 *  - a **Stellar account address**, checked by the two validators that already
 *    exist in the monorepo — `stellarAddressSchema` (`@ancore/types`) for the
 *    cheap `G…` shape gate, then `assertValidEd25519PublicKey`
 *    (`@ancore/account-abstraction`, wrapping `StrKey.isValidEd25519PublicKey`)
 *    for the real base32 + CRC16 checksum; or
 *  - an **`@username` handle**, checked by `isUsernameHandle` (`@ancore/types`).
 *
 * Handles pass this layer on *syntax only* — resolving one to an address needs
 * a network call, and no Zod schema in this repo is async. Resolution is the
 * separate step in ../recipients.ts, mirroring how the extension and dashboard
 * split `validateRecipientInput` from `resolveSendRecipient`.
 */

/** Field labels used to build per-field messages. */
type RecipientFieldLabel = 'Destination' | 'Recipient';

/**
 * Whether `value` is a Stellar account address that would survive submission.
 *
 * Unlike the format-only checks used in form UIs, this verifies the trailing
 * CRC16 checksum, so a well-formed-but-invented `G…` string is rejected here
 * rather than at the network. Exported for ../risk.ts, which needs the same
 * notion of "usable address" without duplicating the composition.
 */
export function isStellarAccountAddress(value: string): boolean {
  // Cheap shape gate first — avoids the SDK call for obvious non-addresses.
  if (!stellarAddressSchema.safeParse(value).success) {
    return false;
  }

  try {
    assertValidEd25519PublicKey(value);
    return true;
  } catch (err) {
    // Only a validation failure means "not an address"; anything else is a bug
    // in the SDK path and must not be silently reported as invalid input.
    if (err instanceof StrKeyValidationError) {
      return false;
    }
    throw err;
  }
}

/**
 * Whether `value` is something a payment or invoice may be addressed to:
 * a checksum-valid Stellar address, or a syntactically valid `@handle`.
 */
export function isAcceptableRecipient(value: string): boolean {
  return isStellarAccountAddress(value) || isUsernameHandle(value);
}

/**
 * Builds the schema for a recipient-bearing field.
 *
 * Parameterised by label so `destination` and `recipient` keep the distinct,
 * user-facing wording they already had — the draft-intent route keys its
 * "Needs clarification" 400 off the word "destination" appearing in the error
 * (see ../server.ts), so that word must survive into the message.
 */
export function createRecipientSchema(label: RecipientFieldLabel) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(isAcceptableRecipient, {
      message: `${label} must be a Stellar address (G...) or an @username handle`,
    });
}
