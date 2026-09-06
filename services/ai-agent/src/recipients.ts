import { isUsernameHandle, normalizeUsernameHandle, type HandleResolver } from '@ancore/types';
import type { Intent } from './schemas/intent';

/**
 * Phase two of recipient validation (issue #1210).
 *
 * The Zod layer (schemas/recipient.ts) accepts an `@handle` on syntax alone,
 * because resolving one needs a network call and no schema in this repo is
 * async. This module performs that resolution and normalises the result, so
 * everything downstream — the risk score, the summary, and whatever eventually
 * executes the payment — only ever sees a checksum-valid Stellar address.
 *
 * The split mirrors the wallet clients, which validate the recipient field
 * synchronously and then resolve it in a separate async step
 * (see apps/web-dashboard/src/hooks/useSendTransaction.ts).
 */

/** Raised when a syntactically valid handle cannot be turned into an address. */
export class RecipientResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipientResolutionError';
  }
}

/** The recipient-bearing field, which is named differently per intent type. */
export function getIntentRecipient(intent: Intent): string {
  return intent.type === 'payment' ? intent.destination : intent.recipient;
}

/** Field label used in resolution errors, matching the schema's wording. */
function fieldLabel(intent: Intent): string {
  return intent.type === 'payment' ? 'destination' : 'recipient';
}

/**
 * Returns `intent` with its recipient guaranteed to be a Stellar address.
 *
 * An address passes through untouched. A handle is resolved and **replaced**
 * by the resulting address, with the original handle preserved in
 * `resolvedFrom` for display — the same address-for-execution /
 * handle-for-display split the clients use (`ResolvedSendRecipient`).
 *
 * @param resolver Handle resolver, or `null` when none is configured — in
 *   which case a handle is rejected rather than passed through unresolved.
 * @throws {RecipientResolutionError} if the handle does not resolve.
 */
export async function resolveIntentRecipient(
  intent: Intent,
  resolver: HandleResolver | null
): Promise<Intent> {
  const value = getIntentRecipient(intent);

  // Already an address — the schema admits nothing else at this point.
  if (!isUsernameHandle(value)) {
    return intent;
  }

  const label = fieldLabel(intent);

  if (!resolver) {
    throw new RecipientResolutionError(
      `Unable to resolve ${label} "${value}": no handle resolver is configured`
    );
  }

  const handle = normalizeUsernameHandle(value);
  const resolved = await resolver(handle);

  if (!resolved) {
    throw new RecipientResolutionError(`Unable to resolve ${label} "${handle}": handle not found`);
  }

  return intent.type === 'payment'
    ? { ...intent, destination: resolved.accountAddress, resolvedFrom: handle }
    : { ...intent, recipient: resolved.accountAddress, resolvedFrom: handle };
}
