/**
 * @ancore/stellar
 * Stellar network integration utilities
 */

export const STELLAR_VERSION = '0.1.0';

// Client
export { StellarClient } from './client';
export type {
  AccountActivityPage,
  AccountActivityPageRequest,
  AssetMetadata,
  AssetMetadataCacheMetrics,
  Balance,
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

// Retry utilities
export { withRetry, calculateDelay } from './retry';
export type { RetryOptions } from './retry';
