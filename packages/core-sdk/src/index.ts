/**
 * @ancore/core-sdk
 * Core SDK for Ancore wallet integration
 */

export const SDK_VERSION = '0.1.0';

export {
  createWallet,
  importWallet,
  restoreWallet,
  deriveContractId,
  type CreateWalletOptions,
  type ImportWalletOptions,
  type RestoreWalletOptions,
  type WalletMaterial,
} from './wallet';

// Client
export { AncoreClient, type AncoreClientOptions } from './ancore-client';

// Session key helpers
export { addSessionKey, type AddSessionKeyParams } from './add-session-key';
export { revokeSessionKey, type RevokeSessionKeyParams } from './revoke-session-key';
export {
  refreshSessionKeyTtl,
  parseSessionKeyTtlRefreshedEvent,
  type RefreshSessionKeyTtlParams,
  type RefreshSessionKeyTtlOptions,
  type RefreshSessionKeyTtlResult,
  type SessionKeyTtlRefreshedEvent,
} from './refresh-session-key-ttl';
export {
  permissionToLabel,
  permissionsToLabels,
  formatPermissions,
  isSessionKeyActive,
  getSessionKeyInactiveReason,
  type IsSessionKeyActiveOptions,
  type SessionKeyInactiveReason,
} from './session-key-utils';

// Payment
export {
  sendPayment,
  type SendPaymentParams,
  type SendPaymentDeps,
  type PaymentSigner,
} from './send-payment';

// Payment Request
export { parsePaymentRequest, type PaymentRequest } from './payment-request';

// Amount normalization
export { normalizeAmount, type NormalizationOptions } from './amount';
export { formatFiatAmount, type FiatFormatOptions } from './fiat-formatter';

// Account transaction builder (wrapper around Stellar SDK's TransactionBuilder)
export {
  AccountTransactionBuilder,
  type AccountTransactionBuilderOptions,
} from './account-transaction-builder';

// Contract parameter encoding helpers
export {
  toScAddress,
  toScOperationsVec,
  toScPermissionsVec,
  toScU32,
  toScU64,
} from './contract-params';

// Error types
export {
  AncoreSdkError,
  BuilderValidationError,
  SessionKeyExecutionError,
  SessionKeyExecutionValidationError,
  SessionKeyManagementError,
  SimulationExpiredError,
  SimulationFailedError,
  TransactionSubmissionError,
  PaymentRequestValidationError,
  InvalidAmountError,
  StrKeyValidationError,
  assertValidEd25519PublicKey,
  assertValidContractId,
} from './errors';

// Normalization helpers
export type { ErrorCategory, NormalizedError } from './errors';
export { normalizeError } from './errors';

// Retry policy presets
export {
  LOW_LATENCY,
  RELIABLE,
  AGGRESSIVE,
  RETRY_PRESETS,
  type RetryPresetName,
  getRetryPreset,
} from './retry-presets';

// Account sequence fetch helper — re-exported from @ancore/stellar for SDK consumers.
// Use fetchAccountSequence to retrieve a Stellar account's current sequence number
// before building transactions in the send flow.
//
// Example:
//   import { fetchAccountSequence } from '@ancore/core-sdk';
//   const { sequence } = await fetchAccountSequence(horizonServer, publicKey, {
//     maxRetries: 3,
//     cacheTtlMs: 5_000,
//   });
export {
  fetchAccountSequence,
  clearSequenceCache,
  type AccountSequenceResult,
  type FetchAccountSequenceOptions,
} from '@ancore/stellar';

// Scheduled transfers
export {
  HttpSchedulerClient,
  createSchedulerClient,
  getSchedulerClient,
  resetSchedulerClientForTests,
  resolveRelayerBaseUrl,
  buildDefaultRelayPayload,
  toIsoStartAt,
  defaultScheduleStartAt,
  SCHEDULE_FREQUENCY_OPTIONS,
  DEMO_ACCOUNT_ADDRESS,
  type SchedulerClient,
  type SchedulerClientOptions,
} from './scheduler-client';

export {
  mapExecuteWithSessionKeyError,
  type ExecuteWithSessionKeyParams,
  type ExecuteWithSessionKeyResult,
  type SessionKeyExecutionLayer,
  type SessionKeyExecutionRequest,
  type SessionKeySignerInputs,
} from './execute-with-session-key';

// Secure Storage
export {
  SecureStorageManager,
  type SecureStorageManagerOptions,
} from './storage/secure-storage-manager';
export {
  saveSessionKeys,
  SESSION_KEYS_STORAGE_KEY,
  type SaveSessionKeysDeps,
} from './storage/save-session-keys';
export { getSessionKeys, type GetSessionKeysDeps } from './storage/get-session-keys';
export type {
  AccountData,
  EncryptedPayload,
  PlatformStorageAdapter,
  RecentRecipient,
  RecentRecipientsData,
  SessionKeysData,
  StorageAdapter,
} from './storage/types';

// Encryption Primitives
export {
  deriveKey,
  encrypt,
  decrypt,
  type EncryptedPayload as EncryptionPayload,
} from './storage/encryption-primitives';

// Backup Export/Import
export { exportBackup, importBackup, type BackupPayload } from './storage/backup';

// Storage Adapter (Chrome/Firefox)
export {
  ChromeStorageAdapter,
  BrowserStorageAdapter,
  LocalStorageAdapter,
  createStorageAdapter,
  StorageError,
  StorageErrorCode,
} from './storage/storage-adapter';
export * from './signing/ledger-adapter';
