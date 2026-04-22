/**
 * Execute integration for AccountContract.
 * Handles XDR encoding, contract invocation, and typed response parsing.
 */

import {
  Account,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { AccountContract } from './account-contract';
import { mapContractError } from './errors';

/** Options for executing contract calls */
export interface ExecuteOptions {
  server: {
    getAccount(accountId: string): Promise<{ id: string; sequence: string }>;
    simulateTransaction(tx: unknown): Promise<unknown>;
    sendTransaction(tx: unknown): Promise<unknown>;
  };
  sourceAccount: string;
  /** Network passphrase (e.g. Networks.TESTNET) */
  networkPassphrase: string;
  /** Transaction fee in stroops */
  fee?: string;
  /** Transaction timeout in seconds */
  timeout?: number;
}

/** Result of a successful contract execution */
export interface ExecuteResult<T = unknown> {
  /** Parsed return value from the contract */
  result: T;
  /** Transaction hash */
  hash: string;
  /** Raw transaction result */
  raw: unknown;
}

/**
 * Encode JavaScript values to XDR ScVal for contract arguments.
 * Supports common types: string, number, boolean, arrays, objects.
 */
export function encodeContractArgs(args: unknown[]): xdr.ScVal[] {
  return args.map((arg) => {
    if (arg === null || arg === undefined) {
      return xdr.ScVal.scvVoid();
    }

    // Use stellar-sdk's native encoding for most types
    try {
      return nativeToScVal(arg);
    } catch (error) {
      throw new Error(`Failed to encode argument ${JSON.stringify(arg)}: ${error}`);
    }
  });
}

/**
 * Parse contract execution result to typed output.
 * Returns the native JavaScript value from the ScVal.
 */
export function parseExecuteResult<T = unknown>(result: xdr.ScVal): T {
  try {
    return scValToNative(result) as T;
  } catch (error) {
    throw new Error(`Failed to parse contract result: ${error}`);
  }
}

/**
 * Execute a contract method with full transaction submission.
 * Encodes arguments, submits transaction, and parses the result.
 */
export async function executeContract<T = unknown>(
  contract: AccountContract,
  to: string,
  functionName: string,
  args: unknown[],
  expectedNonce: number,
  options: ExecuteOptions
): Promise<ExecuteResult<T>> {
  const { server, sourceAccount, networkPassphrase } = options;
  const fee = options.fee ?? '100000'; // Default 0.01 XLM
  const timeout = options.timeout ?? 180;

  try {
    // Encode arguments to XDR
    const encodedArgs = encodeContractArgs(args);

    // Build the execute invocation
    const invocation = contract.execute(to, functionName, encodedArgs, expectedNonce);

    // Get source account for transaction building
    const accountResponse = await server.getAccount(sourceAccount);
    const account = new Account(accountResponse.id, accountResponse.sequence ?? '0');

    // Build transaction
    const operation = contract.buildInvokeOperation(invocation);
    const txBuilder = new TransactionBuilder(account, {
      fee,
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(timeout);

    const transaction = txBuilder.build();

    // Submit transaction
    const submitResult: unknown = await server.sendTransaction(transaction);

    // Check for transaction errors
    if (
      submitResult &&
      typeof submitResult === 'object' &&
      submitResult !== null &&
      (('status' in submitResult && (submitResult as { status: string }).status === 'ERROR') ||
        'error' in submitResult)
    ) {
      const errorMsg =
        ('error' in submitResult ? (submitResult as { error?: string }).error : undefined) ??
        ('result_xdr' in submitResult
          ? (submitResult as { result_xdr?: string }).result_xdr
          : undefined) ??
        'Transaction failed';
      throw mapContractError(String(errorMsg), submitResult);
    }

    // Parse successful result
    let parsedResult: T;
    if (
      submitResult &&
      typeof submitResult === 'object' &&
      submitResult !== null &&
      'result' in submitResult &&
      typeof (submitResult as { result: unknown }).result === 'object' &&
      (submitResult as { result: unknown }).result !== null &&
      'retval' in (submitResult as { result: { retval?: unknown } }).result
    ) {
      const retval = (submitResult as { result: { retval: xdr.ScVal } }).result.retval;
      parsedResult = parseExecuteResult<T>(retval);
    } else {
      // For successful transactions without explicit return value
      parsedResult = null as T;
    }

    return {
      result: parsedResult,
      hash:
        (submitResult &&
        typeof submitResult === 'object' &&
        submitResult !== null &&
        'hash' in submitResult
          ? (submitResult as { hash: string }).hash
          : undefined) ??
        (submitResult &&
        typeof submitResult === 'object' &&
        submitResult !== null &&
        'id' in submitResult
          ? (submitResult as { id: string }).id
          : undefined) ??
        'unknown',
      raw: submitResult,
    };
  } catch (error) {
    // Map known contract errors
    if (error instanceof Error) {
      throw mapContractError(error.message, error);
    }
    throw mapContractError('Contract execution failed', error);
  }
}

/**
 * Simulate a contract execution without submitting the transaction.
 * Useful for testing and gas estimation.
 */
export async function simulateExecute<T = unknown>(
  contract: AccountContract,
  to: string,
  functionName: string,
  args: unknown[],
  expectedNonce: number,
  options: Omit<ExecuteOptions, 'fee'>
): Promise<T> {
  const { server, sourceAccount, networkPassphrase } = options;

  try {
    // Encode arguments to XDR
    const encodedArgs = encodeContractArgs(args);

    // Build the execute invocation
    const invocation = contract.execute(to, functionName, encodedArgs, expectedNonce);

    // Get source account for transaction building
    const accountResponse = await server.getAccount(sourceAccount);
    const account = new Account(accountResponse.id, accountResponse.sequence ?? '0');

    // Build simulation transaction
    const operation = contract.buildInvokeOperation(invocation);
    const txBuilder = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(180);

    const transaction = txBuilder.build();

    // Simulate transaction
    const simResult: unknown = await server.simulateTransaction(transaction);

    // Check for simulation errors
    if (
      simResult &&
      typeof simResult === 'object' &&
      simResult !== null &&
      ('error' in simResult || 'message' in simResult)
    ) {
      const errorMsg =
        ('error' in simResult ? (simResult as { error?: string }).error : undefined) ??
        ('message' in simResult ? (simResult as { message?: string }).message : undefined) ??
        'Simulation failed';
      throw mapContractError(String(errorMsg), simResult);
    }

    // Parse simulation result
    const result =
      simResult &&
      typeof simResult === 'object' &&
      simResult !== null &&
      'result' in simResult &&
      typeof (simResult as { result: unknown }).result === 'object' &&
      (simResult as { result: unknown }).result !== null &&
      'retval' in (simResult as { result: { retval?: unknown } }).result
        ? (simResult as { result: { retval: xdr.ScVal } }).result.retval
        : undefined;
    if (result === undefined) {
      throw mapContractError('No return value from simulation', simResult);
    }

    return parseExecuteResult<T>(result);
  } catch (error) {
    if (error instanceof Error) {
      throw mapContractError(error.message, error);
    }
    throw mapContractError('Contract simulation failed', error);
  }
}
