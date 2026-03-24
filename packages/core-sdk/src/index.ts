/**
 * @ancore/core-sdk
 * Core SDK for Ancore wallet integration
 */

export const SDK_VERSION = '0.1.0';

// SDK client
export { AncoreClient } from './ancore-client';
export type { AncoreClientOptions } from './ancore-client';

// Account transaction builder (wrapper around Stellar SDK's TransactionBuilder)
export {
  AccountTransactionBuilder,
  type AccountTransactionBuilderOptions,
} from './account-transaction-builder';

// Smart account initialization flow
export {
  initializeSmartAccount,
  validateContractId,
  type SmartAccountInitializerContract,
  type SmartAccountInitializerBuilder,
  type InitializeSmartAccountOptions,
  type InitializeSmartAccountResult,
} from './initialize-smart-account';

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
  TransactionSubmissionError,
} from './errors';

// Secure Storage
export { SecureStorageManager } from './storage/secure-storage-manager';
export type {
  EncryptedPayload,
  StorageAdapter,
  AccountData,
  SessionKeysData,
} from './storage/types';
