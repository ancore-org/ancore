import { Contract, nativeToScVal, Transaction, xdr } from '@stellar/stellar-sdk';
import { NotImplementedError } from './errors';

export type TransactionBuilderOptions = {
  fee?: string;
  networkPassphrase?: string;
  timeoutSeconds?: number;
};

export interface ContractExecuteParams {
  contractId: string;
  method: string;
  args: unknown[];
}

type BuilderOp =
  | {
      type: 'sessionKey';
      op: 'add' | 'revoke';
      sessionKey: string;
      permissions: number[];
      expiresAt: number;
    }
  | ({ type: 'contractExecute' } & ContractExecuteParams);

export interface SimulationResult {
  fee: string;
  operationCount: number;
}

export class TransactionBuilder {
  private readonly source: string;
  private readonly accountContractId: string;
  private readonly ops: BuilderOp[] = [];
  private readonly fee: string;
  private readonly networkPassphrase: string;
  private readonly timeoutSeconds: number;

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
  }

  addSessionKey(sessionKey: string, permissions: number[], expiresAt: number) {
    this.assertSessionKeyParams(sessionKey, permissions, expiresAt);
    this.ops.push({
      type: 'sessionKey',
      op: 'add',
      sessionKey,
      permissions,
      expiresAt,
    });
    return this;
  }

  revokeSessionKey(sessionKey: string) {
    if (!sessionKey || typeof sessionKey !== 'string') {
      throw new TypeError('revokeSessionKey requires a non-empty sessionKey string.');
    }

    this.ops.push({
      type: 'sessionKey',
      op: 'revoke',
      sessionKey,
      permissions: [],
      expiresAt: 0,
    });
    return this;
  }

  executeContract(params: ContractExecuteParams) {
    if (!params.contractId || typeof params.contractId !== 'string') {
      throw new TypeError('executeContract requires a valid contractId.');
    }
    if (!params.method || typeof params.method !== 'string') {
      throw new TypeError('executeContract requires a valid method name.');
    }

    this.ops.push({ type: 'contractExecute', ...params });
    return this;
  }

  async simulate(): Promise<SimulationResult> {
    return {
      fee: this.fee,
      operationCount: this.ops.length,
    };
  }

  build(): Transaction {
    throw new NotImplementedError(
      'Soroban envelope construction — call simulate() against a real Soroban RPC node first'
    );
  }

  private buildOperation(op: BuilderOp): xdr.Operation {
    if (op.type === 'contractExecute') {
      const contract = new Contract(op.contractId);
      const args = op.args.map((value) => nativeToScVal(value));
      return contract.call(op.method, ...args);
    }

    const contract = new Contract(this.accountContractId);
    if (op.op === 'add') {
      return contract.call(
        'add_session_key',
        nativeToScVal(op.sessionKey),
        nativeToScVal(op.expiresAt),
        nativeToScVal(op.permissions)
      );
    }

    return contract.call('revoke_session_key', nativeToScVal(op.sessionKey));
  }

  private assertSessionKeyParams(
    sessionKey: string,
    permissions: number[],
    expiresAt: number
  ): void {
    if (!sessionKey || typeof sessionKey !== 'string') {
      throw new TypeError('Session key must be a non-empty string.');
    }
    if (!Array.isArray(permissions)) {
      throw new TypeError('Session key permissions must be an array.');
    }
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
      throw new TypeError('Session key expiresAt must be a finite number.');
    }
  }
}
