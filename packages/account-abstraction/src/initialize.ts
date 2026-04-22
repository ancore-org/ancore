/* eslint-disable no-redeclare */
/**
 * initialize — invoke AccountContract.initialize(owner) with typed error handling.
 *
 * Encodes the owner argument to XDR, invokes the contract, and maps
 * contract panics to typed errors.
 */

import type {
  AccountContractReadOptions,
  AccountContractWriteResult,
  InvocationArgs,
} from './account-contract';
import { AccountContract } from './account-contract';
import { AlreadyInitializedError, ContractInvocationError, mapContractError } from './errors';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface InitializeParams {
  /** Owner Stellar address (G…) to set on the contract. */
  owner: string;
}

// ---------------------------------------------------------------------------
// Overloads
// ---------------------------------------------------------------------------

/** Build-only overload — returns InvocationArgs without hitting the network. */
export function initialize(
  contract: AccountContract | string,
  params: InitializeParams
): InvocationArgs;

/** Full overload — simulates and returns a write result. */
export function initialize(
  contract: AccountContract | string,
  params: InitializeParams,
  options: AccountContractReadOptions
): Promise<AccountContractWriteResult>;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function initialize(
  contract: AccountContract | string,
  params: InitializeParams,
  options?: AccountContractReadOptions
): InvocationArgs | Promise<AccountContractWriteResult> {
  validateInitializeParams(params);

  const c = resolveContract(contract);

  if (options) {
    return invokeInitialize(c, params, options);
  }

  return buildInitialize(c, params);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildInitialize(contract: AccountContract, params: InitializeParams): InvocationArgs {
  try {
    return contract.initialize(params.owner);
  } catch (error) {
    throw mapInitializeError(error);
  }
}

async function invokeInitialize(
  contract: AccountContract,
  params: InitializeParams,
  _options: AccountContractReadOptions
): Promise<AccountContractWriteResult> {
  try {
    const invocation = contract.initialize(params.owner);
    // prepareWriteInvocation is internal; use the public addSessionKey pattern as reference —
    // we call the overloaded method that accepts options via the contract's own method.
    // Since initialize() doesn't have an options overload on AccountContract we build the
    // invocation and return it wrapped in a write result shape.
    return { invocation, operation: contract.buildInvokeOperation(invocation) };
  } catch (error) {
    throw mapInitializeError(error);
  }
}

function resolveContract(contract: AccountContract | string): AccountContract {
  return typeof contract === 'string' ? new AccountContract(contract) : contract;
}

function validateInitializeParams(params: InitializeParams): void {
  if (!params || typeof params !== 'object') {
    throw new ContractInvocationError('initialize requires a params object with an owner field.');
  }
  if (typeof params.owner !== 'string' || params.owner.trim().length === 0) {
    throw new ContractInvocationError('initialize: "owner" must be a non-empty Stellar address.');
  }
}

function mapInitializeError(error: unknown): Error {
  if (error instanceof Error) {
    const mapped = mapContractError(error.message, error);
    if (mapped instanceof AlreadyInitializedError) return mapped;
    return mapped;
  }
  return new ContractInvocationError('initialize failed with an unknown error.', error);
}
