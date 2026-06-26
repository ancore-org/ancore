import type { InvocationArgs } from '@ancore/account-abstraction';
import {
  AccountContract,
  AccountContractError,
  bytes32ScValToPublicKey,
  mapContractError,
  scValToU64,
  type AccountContractReadOptions,
} from '@ancore/account-abstraction';
import { Account, rpc, TransactionBuilder, xdr } from '@stellar/stellar-sdk';

import {
  AncoreSdkError,
  BuilderValidationError,
  SessionKeyManagementError,
  SimulationFailedError,
} from './errors';
import { getSessionKeyInactiveReason, isSessionKeyActive } from './session-key-utils';

export interface RefreshSessionKeyTtlParams {
  /** Ed25519 public key (G…) of the session key whose Soroban TTL should be extended. */
  publicKey: string;
  /**
   * Known logical expiry of the session key in Unix **seconds** (from `getSessionKey` or
   * local state). Used for client-side preflight via `isSessionKeyActive`; the on-chain
   * `refresh_session_key_ttl` call does **not** accept or modify this value.
   */
  expiresAt: number;
}

export interface RefreshSessionKeyTtlOptions extends AccountContractReadOptions {
  /**
   * Override the current time (Unix timestamp in milliseconds).
   * Defaults to `Date.now()`. Useful for deterministic testing.
   */
  nowMs?: number;
}

export interface SessionKeyTtlRefresher {
  refreshSessionKeyTtl(publicKey: string): InvocationArgs;
  buildInvokeOperation(
    invocation: InvocationArgs
  ): ReturnType<AccountContract['buildInvokeOperation']>;
}

export interface SessionKeyTtlRefreshedEvent {
  type: 'session_key_ttl_refreshed';
  publicKey: string;
  /** Logical expiry in Unix seconds echoed from the contract event. */
  expiresAt: number;
}

export interface RefreshSessionKeyTtlResult {
  invocation: InvocationArgs;
  operation: ReturnType<SessionKeyTtlRefresher['buildInvokeOperation']>;
  event: SessionKeyTtlRefreshedEvent | null;
}

const VALIDATION_ERROR_PATTERNS = [/invalid stellar public key/i, /invalid ed25519 public key/i];

const SESSION_KEY_TTL_REFRESHED_TOPIC = 'session_key_ttl_refreshed';

/**
 * Build invocation args for `refresh_session_key_ttl(public_key)`.
 *
 * ## Expiry semantics
 *
 * - On-chain `refresh_session_key_ttl` **extends Soroban persistent storage TTL** so the
 *   key entry is not evicted before its logical `expires_at`. It does **not** change
 *   `expires_at` (except for one-time millisecond→second normalization inside the contract).
 * - Use {@link isSessionKeyActive} with the known `expiresAt` (seconds) **before** calling
 *   this helper. Expired or revoked keys (`expiresAt === 0`) are rejected locally; the
 *   contract also returns `SESSION_KEY_EXPIRED` when `expires_at <= ledger.timestamp()`.
 * - To **extend logical lifetime**, use `addSessionKey` with a new `expiresAt` instead.
 *
 * @example
 * ```ts
 * // Build-only (no network)
 * const invocation = refreshSessionKeyTtl(accountContract, {
 *   publicKey: 'GABC...',
 *   expiresAt: Math.floor(Date.now() / 1000) + 3600,
 * });
 *
 * // Simulate + parse emitted event
 * const result = await refreshSessionKeyTtl(accountContract, params, {
 *   server,
 *   sourceAccount: ownerAddress,
 *   networkPassphrase: Networks.TESTNET,
 * });
 * ```
 */
/* eslint-disable no-redeclare -- TypeScript function overload signatures */
export function refreshSessionKeyTtl(
  accountContract: SessionKeyTtlRefresher,
  params: RefreshSessionKeyTtlParams
): InvocationArgs;
export function refreshSessionKeyTtl(
  accountContract: SessionKeyTtlRefresher,
  params: RefreshSessionKeyTtlParams,
  options: RefreshSessionKeyTtlOptions
): Promise<RefreshSessionKeyTtlResult>;
export function refreshSessionKeyTtl(
  accountContract: SessionKeyTtlRefresher,
  params: RefreshSessionKeyTtlParams,
  options?: RefreshSessionKeyTtlOptions
): InvocationArgs | Promise<RefreshSessionKeyTtlResult> {
  /* eslint-enable no-redeclare */
  validateRefreshSessionKeyTtlParams(params, options?.nowMs);
  /* eslint-enable no-redeclare */

  if (options) {
    return simulateRefreshSessionKeyTtl(accountContract, params, options);
  }

  try {
    return accountContract.refreshSessionKeyTtl(params.publicKey);
  } catch (error) {
    throw normalizeRefreshSessionKeyTtlError(error, params);
  }
}

/**
 * Parse a `session_key_ttl_refreshed` contract event from simulation or ledger events.
 */
export function parseSessionKeyTtlRefreshedEvent(
  events: readonly unknown[] | undefined
): SessionKeyTtlRefreshedEvent | null {
  if (!events || events.length === 0) {
    return null;
  }

  for (const entry of events) {
    const parsed = parseSingleSessionKeyTtlRefreshedEvent(entry);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function validateRefreshSessionKeyTtlParams(
  params: RefreshSessionKeyTtlParams,
  nowMs?: number
): void {
  if (!params || typeof params !== 'object') {
    throw new BuilderValidationError(
      'refreshSessionKeyTtl requires a parameter object with publicKey and expiresAt.'
    );
  }

  if (typeof params.publicKey !== 'string' || params.publicKey.trim().length === 0) {
    throw new BuilderValidationError('refreshSessionKeyTtl requires a non-empty publicKey string.');
  }

  if (typeof params.expiresAt !== 'number' || !Number.isFinite(params.expiresAt)) {
    throw new BuilderValidationError(
      'refreshSessionKeyTtl requires expiresAt to be a finite number.'
    );
  }

  if (
    !isSessionKeyActive({ expiresAt: params.expiresAt, publicKey: params.publicKey }, { nowMs })
  ) {
    const reason = getSessionKeyInactiveReason(
      { expiresAt: params.expiresAt, publicKey: params.publicKey },
      { nowMs }
    );

    if (reason === 'REVOKED') {
      throw new BuilderValidationError(
        'refreshSessionKeyTtl cannot refresh a revoked session key (expiresAt === 0).'
      );
    }

    if (reason === 'EXPIRED') {
      throw new SessionKeyManagementError(
        'Session key has expired and cannot have its storage TTL refreshed.',
        'SESSION_KEY_EXPIRED'
      );
    }

    throw new BuilderValidationError(
      'refreshSessionKeyTtl requires an active session key. Verify expiresAt with isSessionKeyActive().'
    );
  }
}

async function simulateRefreshSessionKeyTtl(
  accountContract: SessionKeyTtlRefresher,
  params: RefreshSessionKeyTtlParams,
  options: RefreshSessionKeyTtlOptions
): Promise<RefreshSessionKeyTtlResult> {
  let invocation: InvocationArgs;

  try {
    invocation = accountContract.refreshSessionKeyTtl(params.publicKey);
  } catch (error) {
    throw normalizeRefreshSessionKeyTtlError(error, params);
  }

  const operation = accountContract.buildInvokeOperation(invocation);
  const simulation = await simulateInvocation(operation, options);

  if (rpc.Api.isSimulationError(simulation)) {
    throw mapSimulationError(
      (simulation as rpc.Api.SimulateTransactionErrorResponse).error,
      params
    );
  }

  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new SimulationFailedError('Unexpected simulation response for refresh_session_key_ttl.');
  }

  const event = parseSessionKeyTtlRefreshedEvent(simulation.events);

  return {
    invocation,
    operation,
    event,
  };
}

async function simulateInvocation(
  operation: xdr.Operation,
  options: RefreshSessionKeyTtlOptions
): Promise<rpc.Api.SimulateTransactionResponse> {
  const accountResponse = await options.server.getAccount(options.sourceAccount);
  const account = new Account(accountResponse.id, accountResponse.sequence ?? '0');

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: options.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(180)
    .build();

  return options.server.simulateTransaction(tx) as Promise<rpc.Api.SimulateTransactionResponse>;
}

function mapSimulationError(message: string, params: RefreshSessionKeyTtlParams): AncoreSdkError {
  const mapped = mapContractError(message, undefined, { sessionPublicKey: params.publicKey });

  if (mapped.code && mapped.code !== 'CONTRACT_INVOCATION') {
    return new SessionKeyManagementError(mapped.message, mapped.code, mapped);
  }

  return new SimulationFailedError(message);
}

function normalizeRefreshSessionKeyTtlError(
  error: unknown,
  params: RefreshSessionKeyTtlParams
): AncoreSdkError {
  if (error instanceof AncoreSdkError) {
    return error;
  }

  if (error instanceof AccountContractError) {
    return new SessionKeyManagementError(error.message, error.code, error);
  }

  if (error instanceof Error) {
    if (VALIDATION_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))) {
      return new BuilderValidationError(error.message);
    }

    const mapped = mapContractError(error.message, error, {
      sessionPublicKey: params.publicKey,
    });

    if (mapped.code && mapped.code !== 'CONTRACT_INVOCATION') {
      return new SessionKeyManagementError(mapped.message, mapped.code, mapped);
    }

    return new SessionKeyManagementError(
      `Failed to refresh session key TTL: ${error.message}`,
      'SESSION_KEY_TTL_REFRESH_FAILED',
      error
    );
  }

  return new SessionKeyManagementError(
    'Failed to refresh session key TTL due to an unknown error.',
    'SESSION_KEY_TTL_REFRESH_FAILED',
    error
  );
}

function parseSingleSessionKeyTtlRefreshedEvent(
  entry: unknown
): SessionKeyTtlRefreshedEvent | null {
  const contractEvent = extractContractEvent(entry);
  if (!contractEvent) {
    return null;
  }

  const topics = contractEvent.body().v0().topics();
  const topicSymbol = topics[0]?.sym()?.toString();
  if (topicSymbol !== SESSION_KEY_TTL_REFRESHED_TOPIC) {
    return null;
  }

  const data = contractEvent.body().v0().data();
  if (data.switch().name !== 'scvVec') {
    return null;
  }

  const vec = data.vec();
  if (!vec || vec.length < 2) {
    return null;
  }

  return {
    type: SESSION_KEY_TTL_REFRESHED_TOPIC,
    publicKey: bytes32ScValToPublicKey(vec[0]),
    expiresAt: scValToU64(vec[1]),
  };
}

function extractContractEvent(entry: unknown): xdr.ContractEvent | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as {
    event?: xdr.ContractEvent | xdr.DiagnosticEvent | ContractEventLike;
    contractEvent?: xdr.ContractEvent | ContractEventLike;
  };

  if (record.contractEvent && isContractEventLike(record.contractEvent)) {
    return record.contractEvent as xdr.ContractEvent;
  }

  const event = record.event;
  if (!event) {
    return null;
  }

  if (event instanceof xdr.ContractEvent || isContractEventLike(event)) {
    return event as xdr.ContractEvent;
  }

  if (event instanceof xdr.DiagnosticEvent) {
    const inner = event.event();
    if (inner.type() === xdr.ContractEventType.contract()) {
      return inner;
    }
  }

  return null;
}

interface ContractEventLike {
  body(): {
    v0(): {
      topics(): xdr.ScVal[];
      data(): xdr.ScVal;
    };
  };
}

function isContractEventLike(value: unknown): value is ContractEventLike {
  if (!value || typeof value !== 'object' || !('body' in value)) {
    return false;
  }

  return typeof (value as ContractEventLike).body === 'function';
}
