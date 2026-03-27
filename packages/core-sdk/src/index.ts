/**
 * @ancore/core-sdk
 * Core SDK for Ancore wallet integration
 */

export const SDK_VERSION = '0.1.0';

// Client
export { AncoreClient, type AncoreClientOptions } from './ancore-client';

// Session key helpers
export { addSessionKey, type AddSessionKeyParams } from './add-session-key';

// Account transaction builder (wrapper around Stellar SDK's TransactionBuilder)
export {
  AccountTransactionBuilder,
  type AccountTransactionBuilderOptions,
} from './account-transaction-builder';

// Contract parameter encoding helpers
export {
  toScAddress,
  toScU64,
  toScU32,
  toScPermissionsVec,
  toScOperationsVec,
} from './contract-params';

// Error types
export {
  AncoreSdkError,
  SimulationFailedError,
  SimulationExpiredError,
  BuilderValidationError,
  SessionKeyManagementError,
  TransactionSubmissionError,
  SessionKeyExecutionValidationError,
  SessionKeyExecutionError,
} from './errors';

export {
  AncoreClient,
  mapExecuteWithSessionKeyError,
  type AncoreClientOptions,
  type ExecuteWithSessionKeyParams,
  type ExecuteWithSessionKeyResult,
  type SessionKeyExecutionLayer,
  type SessionKeyExecutionRequest,
  type SessionKeySignerInputs,
} from './execute-with-session-key';

// Secure Storage
export { SecureStorageManager } from './storage/secure-storage-manager';
export type {
  EncryptedPayload,
  StorageAdapter,
  AccountData,
  SessionKeysData,
} from './storage/types';
