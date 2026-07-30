/**
 * Shared Stellar address validation for dashboard forms.
 *
 * Send, Create Invoice and Split Bill each used to accept free text (or carried
 * their own copy of the same regex), so a typo only surfaced once the network
 * rejected the transaction. This module is the single place those forms check
 * an address against, and the single place the wording of the error lives.
 *
 * Stellar StrKeys are 56 characters: a one-character type prefix followed by 55
 * base32 characters (`A`–`Z`, `2`–`7`). Two prefixes matter here:
 *
 * | Prefix | Kind       | Used for                                     |
 * | ------ | ---------- | -------------------------------------------- |
 * | `G`    | `account`  | classic Ed25519 account                      |
 * | `C`    | `contract` | Soroban contract id — an Ancore smart account |
 *
 * This is a *format* check: it deliberately does not verify the trailing CRC16
 * checksum, so it is cheap enough to run on every keystroke and it stays
 * consistent with the address checks already used elsewhere in the dashboard.
 * A checksum-valid address is still rejected by the network if the account does
 * not exist — treat a pass here as "worth submitting", not "will succeed".
 */

/** The kinds of Stellar address a form can accept. */
export type StellarAddressKind = 'account' | 'contract';

const PREFIXES: Record<StellarAddressKind, string> = {
  account: 'G',
  contract: 'C',
};

const DEFAULT_KINDS: readonly StellarAddressKind[] = ['account', 'contract'];

/** Total StrKey length: 1 prefix character + 55 base32 characters. */
const STRKEY_LENGTH = 56;

/** The 55 characters after the prefix, in RFC 4648 base32 (no 0, 1, 8 or 9). */
const STRKEY_BODY = /^[A-Z2-7]{55}$/;

/**
 * Whether `value` is a well-formed Stellar address of one of `kinds`.
 *
 * Leading/trailing whitespace is ignored so pasted addresses validate.
 *
 * @param value - Raw field input.
 * @param kinds - Accepted address kinds. Defaults to both `G…` and `C…`.
 */
export function isValidStellarAddress(
  value: string,
  kinds: readonly StellarAddressKind[] = DEFAULT_KINDS
): boolean {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (trimmed.length !== STRKEY_LENGTH) return false;
  if (!kinds.some((kind) => trimmed.startsWith(PREFIXES[kind]))) return false;

  return STRKEY_BODY.test(trimmed.slice(1));
}

export interface StellarAddressErrorOptions {
  /** Accepted address kinds. Defaults to both `G…` and `C…`. */
  kinds?: readonly StellarAddressKind[];
  /**
   * Message to return when the field is blank. Omit to treat blank as valid,
   * which is what an optional address field wants.
   */
  requiredMessage?: string;
}

/** Human-readable description of the accepted formats, e.g. "G… or C…". */
function describeKinds(kinds: readonly StellarAddressKind[]): string {
  const parts = kinds.map((kind) => `${PREFIXES[kind]}…`);
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} or ${parts.at(-1)}`;
}

/**
 * Inline error message for an address field, or `null` when the value is
 * acceptable.
 *
 * Every message contains the word "address" — `useSendTransaction` routes
 * thrown errors to the recipient field on that substring.
 *
 * @example
 * ```ts
 * const error = stellarAddressError(recipient, { requiredMessage: 'Recipient address is required' });
 * ```
 */
export function stellarAddressError(
  value: string,
  options: StellarAddressErrorOptions = {}
): string | null {
  const { kinds = DEFAULT_KINDS, requiredMessage } = options;
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (trimmed === '') {
    return requiredMessage ?? null;
  }

  if (isValidStellarAddress(trimmed, kinds)) {
    return null;
  }

  return `Enter a valid Stellar address (${describeKinds(kinds)})`;
}
