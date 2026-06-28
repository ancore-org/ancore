import {
  Account,
  Contract,
  nativeToScVal,
  Transaction,
  TransactionBuilder as StellarTransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import { publicKeyToBytes32ScVal } from './xdr-utils';
import type { SimulationResult } from './types/simulation';

export type { SimulationResult };

type SorobanData = xdr.SorobanTransactionData;

export type TransactionBuilderOptions = {
  fee?: string;
  networkPassphrase?: string;
  timeoutSeconds?: number;
  sorobanData?: SorobanData;
};

export interface ContractExecuteParams {
  contractId: string;
  method: string;
  args: unknown[];
}

type BuilderOp =
  | {
      type: 'sessionKey';
      op: 'add' | 'revoke' | 'refreshTtl';
      sessionKey: string;
      permissions: number[];
      expiresAt: number;
      ttlSeconds?: number;
    }
  | ({ type: 'contractExecute' } & ContractExecuteParams)
  | { type: 'custom'; operation: xdr.Operation };

export interface RefreshSessionKeyTtlParams {
  /** Session key public key (64-char hex string or G… address). */
  publicKey: string;
  /**
   * Expected remaining logical lifetime in seconds. Used for client-side validation
   * before building the contract invocation; the on-chain call only takes public_key.
   */
  ttlSeconds: number;
}

export class TransactionBuilder {
  private readonly source: string;
  private readonly accountContractId: string;
  private readonly ops: BuilderOp[] = [];
  private fee: string;
  private readonly networkPassphrase: string;
  private readonly timeoutSeconds: number;
  private sorobanData?: SorobanData;
  private simulatedFee?: string;

  constructor(source: string, accountContractId: string, options: TransactionBuilderOptions = {}) {
    if (!source || typeof source !== 'string') {
      throw new TypeError('TransactionBuilder requires a source account ID.');
    }

    if (!accountContractId || typeof accountContractId !== 'string') {
      throw new TypeError('TransactionBuilder requires an account abstraction contract ID.');
    }

    this.source = source;
    this.accountContractId = accountContractId;
    this.fee = options.fee ?? '10000';
    this.networkPassphrase =
      options.networkPassphrase ?? 'Test SDF Future Network ; September 2021';
    this.timeoutSeconds = options.timeoutSeconds ?? 180;
    this.sorobanData = options.sorobanData;
  }

  /**
   * Add a session key to the smart account.
   * @param publicKey - The session key public key (64-char hex string)
   * @param permissions - Array of permission bitmasks
   * @param expiresAt - Unix timestamp when the key expires
   */
  addSessionKey(publicKey: string, permissions: number[], expiresAt: number): this {
    this.assertSessionKeyParams(publicKey, permissions, expiresAt);
    this.ops.push({
      type: 'sessionKey',
      op: 'add',
      sessionKey: publicKey,
      permissions,
      expiresAt,
    });
    return this;
  }

  /**
   * Refresh the Soroban storage TTL for an existing session key.
   * Does not change the key's logical `expires_at`; see `isSessionKeyActive` in core-sdk
   * to verify the key is still active before refreshing.
   *
   * @param params.publicKey - Session key public key
   * @param params.ttlSeconds - Minimum remaining logical lifetime (seconds) the key must have
   */
  refreshSessionKeyTtl(params: RefreshSessionKeyTtlParams): this {
    this.assertRefreshSessionKeyTtlParams(params);
    this.ops.push({
      type: 'sessionKey',
      op: 'refreshTtl',
      sessionKey: params.publicKey,
      permissions: [],
      expiresAt: 0,
      ttlSeconds: params.ttlSeconds,
    });
    return this;
  }

  /**
   * Revoke a session key from the smart account.
   * @param publicKey - The session key public key to revoke (64-char hex string)
   */
  revokeSessionKey(publicKey: string): this {
    if (!publicKey || typeof publicKey !== 'string') {
      throw new TypeError('revokeSessionKey requires a non-empty publicKey string.');
    }

    this.ops.push({
      type: 'sessionKey',
      op: 'revoke',
      sessionKey: publicKey,
      permissions: [],
      expiresAt: 0,
    });
    return this;
  }

  /**
   * Execute a contract call using a session key.
   * @param sessionKey - The session key public key to sign with
   * @param operations - Array of contract execution parameters
   */
  execute(sessionKey: string, operations: ContractExecuteParams[]): this {
    if (!sessionKey || typeof sessionKey !== 'string') {
      throw new TypeError('execute requires a non-empty sessionKey string.');
    }
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new TypeError('execute requires at least one operation.');
    }

    operations.forEach((op) => {
      this.ops.push({ type: 'contractExecute', ...op });
    });

    return this;
  }

  /**
   * Add a custom Stellar operation to the transaction.
   * @param operation - A raw xdr.Operation
   */
  addOperation(operation: xdr.Operation): this {
    this.ops.push({ type: 'custom', operation });
    return this;
  }

  /**
   * Simulate the transaction to estimate fees.
   * In a real implementation, this would call the Soroban RPC simulate method.
   * For MVP, returns estimated values based on operation count.
   */
  async simulate(): Promise<SimulationResult> {
    const operationCount = this.ops.length;
    const baseFee = parseInt(this.fee, 10);
    const estimatedFee = (baseFee * operationCount).toString();
    const resourceFee = (operationCount * 100).toString();

    this.simulatedFee = estimatedFee;

    return {
      fee: estimatedFee,
      operationCount,
      minResourceFee: resourceFee,
      transactionData: this.sorobanData,
    };
  }

  /**
   * Build the final transaction ready for signing.
   * Must call simulate() first to get accurate fee estimates.
   */
  build(): Transaction {
    if (!this.simulatedFee) {
      throw new Error('Must call simulate() before build() to get accurate fee estimates');
    }

    const account = new Account(this.source, '0');
    const stellarBuilder = new StellarTransactionBuilder(account, {
      fee: this.simulatedFee,
      networkPassphrase: this.networkPassphrase,
    });

    this.ops.forEach((op) => {
      stellarBuilder.addOperation(this.buildOperation(op));
    });

    stellarBuilder.setTimeout(this.timeoutSeconds);

    if (this.sorobanData) {
      stellarBuilder.setSorobanData(this.sorobanData);
    }

    return stellarBuilder.build();
  }

  private buildOperation(op: BuilderOp): xdr.Operation {
    if (op.type === 'contractExecute') {
      const contract = new Contract(op.contractId);
      const args = op.args.map((value) => nativeToScVal(value));
      return contract.call(op.method, ...args);
    }

    if (op.type === 'custom') {
      return op.operation;
    }

    const contract = new Contract(this.accountContractId);
    if (op.op === 'add') {
      return contract.call(
        'add_session_key',
        nativeToScVal(op.sessionKey),
        nativeToScVal(op.expiresAt, { type: 'u64' }),
        nativeToScVal(op.permissions)
      );
    }

    if (op.op === 'refreshTtl') {
      return contract.call('refresh_session_key_ttl', publicKeyToBytes32ScVal(op.sessionKey));
    }

    return contract.call('revoke_session_key', nativeToScVal(op.sessionKey));
  }

  private assertRefreshSessionKeyTtlParams(params: RefreshSessionKeyTtlParams): void {
    if (!params || typeof params !== 'object') {
      throw new TypeError('refreshSessionKeyTtl requires a parameter object.');
    }

    if (!params.publicKey || typeof params.publicKey !== 'string') {
      throw new TypeError('refreshSessionKeyTtl requires a non-empty publicKey string.');
    }

    if (typeof params.ttlSeconds !== 'number' || !Number.isFinite(params.ttlSeconds)) {
      throw new TypeError('refreshSessionKeyTtl requires ttlSeconds to be a finite number.');
    }

    if (params.ttlSeconds <= 0) {
      throw new TypeError('refreshSessionKeyTtl requires ttlSeconds to be greater than zero.');
    }
  }

  private assertSessionKeyParams(
    sessionKey: string,
    permissions: number[],
    expiresAt: number
  ): void {
    if (!sessionKey || typeof sessionKey !== 'string') {
      throw new TypeError('Session key must be a non-empty string.');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(sessionKey)) {
      throw new TypeError('Session key must be a 64-character hex string.');
    }
    if (!Array.isArray(permissions)) {
      throw new TypeError('Session key permissions must be an array.');
    }
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
      throw new TypeError('Session key expiresAt must be a finite number.');
    }
  }
}
