/**
 * Stellar address fixtures for the ai-agent test suite.
 *
 * Recipient validation checks the CRC16 checksum (issue #1210), so tests can no
 * longer use placeholder strings like "GDEST" or hand-typed 56-character
 * lookalikes — every address below is a real strkey produced by
 * `StrKey.encodeEd25519PublicKey`, and every one that should be rejected is
 * rejected for the specific reason its name states.
 */

/** Checksum-valid account address — the default payment destination. */
export const VALID_ADDRESS = 'GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7H';

/** A second checksum-valid address, for "known vs. first-time recipient". */
export const OTHER_VALID_ADDRESS = 'GABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEJXA';

/** Checksum-valid address used as the requesting account (`accountId`). */
export const VALID_ACCOUNT_ID = 'GABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQHGPC';

/** Address a handle resolves to, distinct from the addresses above. */
export const RESOLVED_ADDRESS = 'GACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAJJHP';

/**
 * Correct `G` + 55-base32 shape, wrong checksum (last character altered).
 *
 * This is the case a format-only regex cannot catch — it is exactly what a
 * hallucinated or mistyped address looks like.
 */
export const CHECKSUM_INVALID_ADDRESS = 'GAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQDZ7A';

/** Right length and prefix, but `0`/`1`/`8`/`9` are not base32 characters. */
export const NON_BASE32_ADDRESS = 'GCUNKNOWN00000000000000000000000000000000000000000000000';

/** Well-formed `@username` handle per `usernameHandleSchema`. */
export const VALID_HANDLE = '@alice';

/** Well-formed handle syntax that no resolver knows about. */
export const UNRESOLVABLE_HANDLE = '@nobody';
