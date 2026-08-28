/**
 * Shared address display utilities for G/C/M Stellar addresses.
 *
 * All truncation is mid-ellipsis (head…tail) to match the UX spec (#1029).
 * Copy feedback is handled by the `useCopyWithFeedback` hook.
 */

/**
 * Truncate an address with a mid-ellipsis.
 *
 * @param address - The raw address string (G…, C…, M…)
 * @param head    - Characters to keep at the start (default 6)
 * @param tail    - Characters to keep at the end (default 6)
 */
export function truncateAddress(address: string, head = 6, tail = 6): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}\u2026${address.slice(-tail)}`;
}
