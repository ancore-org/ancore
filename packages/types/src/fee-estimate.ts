/**
 * Shared fee and activity cursor types.
 *
 * Consolidates types previously duplicated across the extension send-service
 * and web-dashboard send-service into a single canonical definition.
 *
 * Issue #1023
 */

import type { Network } from './index';

/**
 * Fee estimate returned by send-service implementations.
 *
 * `network` anchors the estimate to a specific Stellar network so callers
 * can detect stale estimates after a network switch.
 */
export interface FeeEstimate {
  /** Base network fee in XLM (e.g. "0.0000100"). */
  baseFee: string;
  /** Total fee including any resource/surge component, in XLM. */
  totalFee: string;
  /** Network the estimate was produced for. */
  network: Network;
}

/**
 * Opaque cursor used for paginating activity / transaction history from the
 * indexer API.  Consumers must treat the value as an opaque string and not
 * attempt to parse it.
 */
export type ActivityCursor = string;

/**
 * A page of results with an optional cursor for the next page.
 */
export interface ActivityPage<T> {
  items: T[];
  /** Cursor to pass as `cursor_after` to fetch the next page, or `null` when exhausted. */
  nextCursor: ActivityCursor | null;
}
