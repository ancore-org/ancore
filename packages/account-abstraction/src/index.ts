/**
 * @ancore/account-abstraction
 * Account abstraction layer for Stellar smart contracts.
 * Provides AccountContract for invoking the Ancore account contract.
 */

export const AA_VERSION = '0.1.0';

export { AccountContract } from './account-contract';
export type { AccountContractReadOptions, InvocationArgs } from './account-contract';

export {
  AccountContractError,
  AlreadyInitializedError,
  NotInitializedError,
  InvalidNonceError,
  UnauthorizedError,
  SessionKeyNotFoundError,
  ContractInvocationError,
  mapContractError,
  CONTRACT_ERROR_MESSAGES,
} from './errors';

export {
  addressToScVal,
  publicKeyToBytes32ScVal,
  u64ToScVal,
  permissionsToScVal,
  symbolToScVal,
  scValToAddress,
  scValToU64,
  bytes32ScValToPublicKey,
  scValToSessionKey,
  scValToOptionalSessionKey,
} from './xdr-utils';
