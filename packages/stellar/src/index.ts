/**
 * @ancore/stellar
 * Stellar network integration utilities
 */

export const STELLAR_VERSION = '0.1.0';

// Client
export { StellarClient, createStellarClient } from './client';
export type {
  AccountActivityPage,
  AccountActivityPageRequest,
  AssetMetadata,
  AssetMetadataCacheMetrics,
  Balance,
  NetworkId,
  StellarClientConfig,
} from './client';

// Errors
export {
  StellarError,
  NetworkError,
  AccountNotFoundError,
  TransactionError,
  RetryExhaustedError,
} from './errors';
export { toCanonicalError as toCanonicalStellarError } from './errors';

// Retry utilities
export {
  withRetry,
  calculateDelay,
  RETRY_PRESETS,
  retryOptionsFromPreset,
  resolveRetryOptions,
} from './retry';
export type { RetryOptions, RetryPresetConfig, RetryPresetName } from './retry';

// Fee stats
export { fetchFeeStats, FALLBACK_FEE_STATS } from './fee-stats';
export type { FeeStats, FeeStatsOptions } from './fee-stats';
