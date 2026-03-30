/* eslint-disable no-redeclare */
/**
 * revokeSessionKey — invoke AccountContract.revoke_session_key(publicKey).
 *
 * Encodes the public key to XDR BytesN<32>, invokes the contract, and maps
 * contract panics to typed errors.
 */

import type {
  AccountContractReadOptions,
  AccountContractWriteResult,
  InvocationArgs,
} from './account-contract';
import { AccountContract } from './account-contract';
import { ContractInvocationError, mapContractError } from './errors';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface RevokeSessionKeyParams {
  /** Ed25519 public key (G… format) of the session key to revoke. */
  publicKey: string | Uint8Array;
}

// ---------------------------------------------------------------------------
// Overloads
// ---------------------------------------------------------------------------

/** Build-only overload — returns InvocationArgs without hitting the network. */
export function revokeSessionKey(
  contract: AccountContract | string,
  params: RevokeSessionKeyParams
): InvocationArgs;

/** Full overload — simulates and returns a write result. */
export function revokeSessionKey(
  contract: AccountContract | string,
  params: RevokeSessionKeyParams,
  options: AccountContractReadOptions
): Promise<AccountContractWriteResult>;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function revokeSessionKey(
  contract: AccountContract | string,
  params: RevokeSessionKeyParams,
  options?: AccountContractReadOptions
): InvocationArgs | Promise<AccountContractWriteResult> {
  validateRevokeSessionKeyParams(params);

  const c = resolveContract(contract);

  if (options) {
    return invokeRevokeSessionKey(c, params, options);
  }

  return buildRevokeSessionKey(c, params);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildRevokeSessionKey(
  contract: AccountContract,
  params: RevokeSessionKeyParams
): InvocationArgs {
  try {
    return contract.revokeSessionKey(params.publicKey);
  } catch (error) {
    throw mapRevokeError(error, params);
  }
}

async function invokeRevokeSessionKey(
  contract: AccountContract,
  params: RevokeSessionKeyParams,
  _options: AccountContractReadOptions
): Promise<AccountContractWriteResult> {
  try {
    const invocation = contract.revokeSessionKey(params.publicKey);
    return { invocation, operation: contract.buildInvokeOperation(invocation) };
  } catch (error) {
    throw mapRevokeError(error, params);
  }
}

function resolveContract(contract: AccountContract | string): AccountContract {
  return typeof contract === 'string' ? new AccountContract(contract) : contract;
}

function validateRevokeSessionKeyParams(params: RevokeSessionKeyParams): void {
  if (!params || typeof params !== 'object') {
    throw new ContractInvocationError(
      'revokeSessionKey requires a params object with a publicKey field.'
    );
  }
  if (
    (typeof params.publicKey !== 'string' || params.publicKey.trim().length === 0) &&
    !(params.publicKey instanceof Uint8Array)
  ) {
    throw new ContractInvocationError(
      'revokeSessionKey: "publicKey" must be a non-empty string or Uint8Array.'
    );
  }
}

function mapRevokeError(error: unknown, params: RevokeSessionKeyParams): Error {
  if (error instanceof Error) {
    const publicKeyStr = typeof params.publicKey === 'string' ? params.publicKey : undefined;
    return mapContractError(error.message, error, { sessionPublicKey: publicKeyStr });
  }
  return new ContractInvocationError('revokeSessionKey failed with an unknown error.', error);
}
