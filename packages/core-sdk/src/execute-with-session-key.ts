import {
  AccountContract,
  AccountContractError,
  InvalidNonceError,
  NotInitializedError,
  UnauthorizedError,
  type InvocationArgs,
} from '@ancore/account-abstraction';
import { Address, StrKey, xdr } from '@stellar/stellar-sdk';

import {
  AncoreSdkError,
  SessionKeyExecutionError,
  SessionKeyExecutionValidationError,
} from './errors';

export interface SessionKeySignerInputs {
  publicKey: string;
  signAuthEntryXdr: (authEntryXdr: string) => Promise<string> | string;
}

export interface ExecuteWithSessionKeyParams<
  TArgs extends readonly xdr.ScVal[] = readonly xdr.ScVal[],
> {
  target: string;
  function: string;
  args: TArgs;
  expectedNonce: number;
  signer: SessionKeySignerInputs;
}

export interface SessionKeyExecutionRequest<
  TArgs extends readonly xdr.ScVal[] = readonly xdr.ScVal[],
> {
  target: string;
  function: string;
  args: TArgs;
  expectedNonce: number;
  signer: SessionKeySignerInputs;
  invocation: InvocationArgs;
}

export interface ExecuteWithSessionKeyResult<TResult = xdr.ScVal> {
  result: TResult;
  transactionHash?: string;
}

export interface SessionKeyExecutionLayer {
  executeWithSessionKey<
    TResult = xdr.ScVal,
    TArgs extends readonly xdr.ScVal[] = readonly xdr.ScVal[],
  >(
    request: SessionKeyExecutionRequest<TArgs>
  ): Promise<ExecuteWithSessionKeyResult<TResult>>;
}

export interface AncoreClientOptions {
  accountContract: AccountContract;
  executionLayer: SessionKeyExecutionLayer;
}

export class AncoreClient {
  private readonly accountContract: AccountContract;
  private readonly executionLayer: SessionKeyExecutionLayer;

  constructor(options: AncoreClientOptions) {
    this.accountContract = options.accountContract;
    this.executionLayer = options.executionLayer;
  }

  async executeWithSessionKey<
    TResult = xdr.ScVal,
    TArgs extends readonly xdr.ScVal[] = readonly xdr.ScVal[],
  >(params: ExecuteWithSessionKeyParams<TArgs>): Promise<ExecuteWithSessionKeyResult<TResult>> {
    const request = validateExecuteWithSessionKeyParams(params);

    try {
      const invocation = this.accountContract.execute(
        request.target,
        request.function,
        Array.from(request.args),
        request.expectedNonce
      );

      return await this.executionLayer.executeWithSessionKey<TResult, TArgs>({
        ...request,
        invocation,
      });
    } catch (error) {
      throw mapExecuteWithSessionKeyError(error);
    }
  }
}

export function mapExecuteWithSessionKeyError(error: unknown): AncoreSdkError {
  if (error instanceof AncoreSdkError) {
    return error;
  }

  if (error instanceof UnauthorizedError) {
    return new SessionKeyExecutionError('SESSION_KEY_EXECUTION_UNAUTHORIZED', error.message, error);
  }

  if (error instanceof InvalidNonceError) {
    return new SessionKeyExecutionError(
      'SESSION_KEY_EXECUTION_INVALID_NONCE',
      error.message,
      error
    );
  }

  if (error instanceof NotInitializedError) {
    return new SessionKeyExecutionError(
      'SESSION_KEY_EXECUTION_NOT_INITIALIZED',
      error.message,
      error
    );
  }

  if (error instanceof AccountContractError) {
    return new SessionKeyExecutionError('SESSION_KEY_EXECUTION_CONTRACT', error.message, error);
  }

  if (error instanceof Error) {
    return new SessionKeyExecutionError('SESSION_KEY_EXECUTION_FAILED', error.message, error);
  }

  return new SessionKeyExecutionError(
    'SESSION_KEY_EXECUTION_FAILED',
    'Session key execution failed with an unknown error.',
    error
  );
}

function validateExecuteWithSessionKeyParams<
  TArgs extends readonly xdr.ScVal[] = readonly xdr.ScVal[],
>(params: ExecuteWithSessionKeyParams<TArgs>): ExecuteWithSessionKeyParams<TArgs> {
  const { target, function: functionName, args, expectedNonce, signer } = params;

  try {
    new Address(target);
  } catch {
    throw new SessionKeyExecutionValidationError(
      'target must be a valid Stellar address in G... or C... format.'
    );
  }

  if (!functionName || functionName.trim().length === 0) {
    throw new SessionKeyExecutionValidationError('function is required.');
  }

  if (!Array.isArray(args)) {
    throw new SessionKeyExecutionValidationError('args must be an array of ScVal values.');
  }

  if (!Number.isInteger(expectedNonce) || expectedNonce < 0) {
    throw new SessionKeyExecutionValidationError('expectedNonce must be a non-negative integer.');
  }

  if (!signer || !StrKey.isValidEd25519PublicKey(signer.publicKey)) {
    throw new SessionKeyExecutionValidationError(
      'signer.publicKey must be a valid Stellar Ed25519 public key.'
    );
  }

  if (typeof signer.signAuthEntryXdr !== 'function') {
    throw new SessionKeyExecutionValidationError('signer.signAuthEntryXdr must be a function.');
  }

  return params;
}
