/**
 * AccountContract wraps Soroban account abstraction contract invocations.
 * Provides a TypeScript API for initialize, execute, session keys, and read methods.
 */

import type { SessionKey } from '@ancore/types';
import { Account, Contract, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { mapContractError } from './errors';
import {
  addressToScVal,
  permissionsToScVal,
  publicKeyToBytes32ScVal,
  scValToAddress,
  scValToOptionalSessionKey,
  scValToU64,
  symbolToScVal,
  u64ToScVal,
} from './xdr-utils';
import {
  executeContract,
  simulateExecute,
  type ExecuteOptions,
  type ExecuteResult,
} from './execute';

/** Options for read calls (getOwner, getNonce, getSessionKey) when using a server */
export interface AccountContractReadOptions {
  server: {
    getAccount(accountId: string): Promise<{ id: string; sequence: string }>;
    simulateTransaction(tx: unknown): Promise<unknown>;
  };
  sourceAccount: string;
  /** Network passphrase (e.g. Networks.TESTNET); required for building the simulation tx */
  networkPassphrase?: string;
}

/** Result of a contract invocation build (method name + ScVal args) for write methods */
export interface InvocationArgs {
  method: string;
  args: xdr.ScVal[];
}

export interface AccountContractWriteResult {
  invocation: InvocationArgs;
  operation: ReturnType<AccountContract['buildInvokeOperation']>;
}

interface SimulateErrorShape {
  error?: string;
  message?: string;
  result?: {
    retval?: xdr.ScVal;
  };
}

/**
 * AccountContract wraps the Ancore account abstraction contract (contracts/account).
 * Use it to build invoke operations or to run read-only calls via a Soroban RPC server.
 */
export class AccountContract {
  readonly contractId: string;
  private readonly contract: Contract;

  constructor(contractId: string) {
    this.contractId = contractId;
    this.contract = new Contract(contractId);
  }

  /**
   * Build invocation for initialize(owner).
   * Call this once per account; panics if already initialized.
   */
  initialize(owner: string): InvocationArgs {
    return {
      method: 'initialize',
      args: [addressToScVal(owner)],
    };
  }

  /**
   * Build invocation for execute(to, function, args, expected_nonce, session_pub_key?, signature?).
   * Caller must pass the current nonce (e.g. from getNonce()) for replay protection.
   * For session key execution, provide session_pub_key and signature parameters.
   * The signature payload is computed on-chain, so no signature_payload parameter is needed.
   */
  execute(
    to: string,
    fn: string,
    args: xdr.ScVal[],
    expectedNonce: number,
    sessionPubKey?: string | Uint8Array,
    signature?: string | Uint8Array
  ): InvocationArgs {
    const executeArgs = [
      addressToScVal(to),
      symbolToScVal(fn),
      xdr.ScVal.scvVec(args),
      u64ToScVal(expectedNonce),
    ];

    // Add optional session key parameters
    if (sessionPubKey !== undefined) {
      executeArgs.push(publicKeyToBytes32ScVal(sessionPubKey));
    } else {
      executeArgs.push(xdr.ScVal.scvVoid());
    }

    if (signature !== undefined) {
      const signatureBytes: Buffer =
        signature instanceof Uint8Array ? Buffer.from(signature) : Buffer.from(signature, 'base64');
      executeArgs.push(xdr.ScVal.scvBytes(signatureBytes));
    } else {
      executeArgs.push(xdr.ScVal.scvVoid());
    }

    return {
      method: 'execute',
      args: executeArgs,
    };
  }

  /**
   * Build invocation for add_session_key(public_key, expires_at, permissions).
   * Contract order: public_key, expires_at, permissions.
   */
  addSessionKey(
    publicKey: string | Uint8Array,
    permissions: number[],
    expiresAt: number
  ): InvocationArgs {
    return {
      method: 'add_session_key',
      args: [
        publicKeyToBytes32ScVal(publicKey),
        u64ToScVal(expiresAt),
        permissionsToScVal(permissions),
      ],
    };
  }

  /**
   * Build invocation for revoke_session_key(public_key).
   */
  revokeSessionKey(publicKey: string | Uint8Array): InvocationArgs {
    return {
      method: 'revoke_session_key',
      args: [publicKeyToBytes32ScVal(publicKey)],
    };
  }

  /**
   * Build invocation for get_session_key(public_key).
   * Use getSessionKey() with options.server to run the read and decode the result.
   */
  getSessionKeyInvocation(publicKey: string | Uint8Array): InvocationArgs {
    return {
      method: 'get_session_key',
      args: [publicKeyToBytes32ScVal(publicKey)],
    };
  }

  /**
   * Build invocation for get_owner (read-only).
   */
  getOwnerInvocation(): InvocationArgs {
    return { method: 'get_owner', args: [] };
  }

  /**
   * Build invocation for get_nonce (read-only).
   */
  getNonceInvocation(): InvocationArgs {
    return { method: 'get_nonce', args: [] };
  }

  /**
   * Return a Stellar operation that invokes the given method with the given args.
   */
  call(method: string, ...args: xdr.ScVal[]) {
    return this.contract.call(method, ...args);
  }

  /**
   * Build a full invoke operation for a write method (initialize, execute, add_session_key, revoke_session_key).
   */
  buildInvokeOperation(invocation: InvocationArgs) {
    return this.contract.call(invocation.method, ...invocation.args);
  }

  /**
   * Get the contract's owner address. Requires server and source account for simulation.
   */
  async getOwner(options: AccountContractReadOptions): Promise<string> {
    const result = await this.simulateRead('get_owner', [], options);
    return scValToAddress(result);
  }

  /**
   * Get the contract's current nonce. Requires server and source account for simulation.
   */
  async getNonce(options: AccountContractReadOptions): Promise<number> {
    const result = await this.simulateRead('get_nonce', [], options);
    return scValToU64(result);
  }

  /**
   * Get a session key by public key. Returns null if not found.
   * Requires server and source account for simulation.
   */
  async getSessionKey(
    publicKey: string | Uint8Array,
    options: AccountContractReadOptions
  ): Promise<SessionKey | null> {
    const result = await this.simulateRead(
      'get_session_key',
      [publicKeyToBytes32ScVal(publicKey)],
      options
    );
    return scValToOptionalSessionKey(result);
  }

  /**
   * Execute a contract method with full transaction submission.
   * Encodes arguments, submits transaction, and returns typed result.
   */
  async executeContract<T = unknown>(
    to: string,
    functionName: string,
    args: unknown[],
    expectedNonce: number,
    options: ExecuteOptions
  ): Promise<ExecuteResult<T>> {
    return executeContract(this, to, functionName, args, expectedNonce, options);
  }

  /**
   * Simulate a contract execution without submitting the transaction.
   * Useful for testing and gas estimation.
   */
  async simulateExecute<T = unknown>(
    to: string,
    functionName: string,
    args: unknown[],
    expectedNonce: number,
    options: Omit<ExecuteOptions, 'fee'>
  ): Promise<T> {
    return simulateExecute(this, to, functionName, args, expectedNonce, options);
  }

  /**
   * Simulate a read-only contract call and return the result ScVal.
   * Throws typed errors on contract/host errors.
   */
  private async simulateRead(
    method: string,
    args: xdr.ScVal[],
    options: AccountContractReadOptions
  ): Promise<xdr.ScVal> {
    const op = this.contract.call(method, ...args);
    const { server, sourceAccount } = options;

    const accountResponse = await server.getAccount(sourceAccount);
    const account = new Account(accountResponse.id, accountResponse.sequence ?? '0');

    const txBuilder = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: options.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(180);

    const raw = txBuilder.build();

    const sim = (await server.simulateTransaction(raw)) as SimulateErrorShape;

    if (sim && typeof sim === 'object' && ('error' in sim || 'message' in sim)) {
      const errMsg =
        (sim as { error?: string }).error ??
        (sim as { message?: string }).message ??
        'Simulation failed';
      throw mapContractError(String(errMsg), sim);
    }

    const result = sim.result?.retval;
    if (result === undefined) {
      throw mapContractError('No return value from simulation', sim);
    }
    return result;
  }
}
