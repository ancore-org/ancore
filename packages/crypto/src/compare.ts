/**
 * Constant-time byte array equality.
 *
 * Always iterates over every byte of the longer array regardless of whether a
 * mismatch is found early, preventing timing side-channels that could leak
 * information about secret values (HMAC tags, derived keys, signatures, etc.).
 *
 * Length mismatch is handled without short-circuiting: a sentinel flag is set
 * and the loop still runs to completion so that execution time stays stable.
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns `true` if both arrays have equal length and identical contents
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length; // non-zero if lengths differ

  for (let i = 0; i < len; i++) {
    // Out-of-bounds reads return `undefined`; coerce to 0 so XOR still runs
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return diff === 0;
}
