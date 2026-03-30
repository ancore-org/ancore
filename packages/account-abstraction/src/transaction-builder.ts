// TransactionBuilder for Soroban account operations
// MVP: Fluent API for session key add/revoke, contract execute, simulation helper, .build()

// import { buildSorobanTransaction } from './xdr-utils'; // Not exported
import { Keypair, Transaction } from '@stellar/stellar-sdk';

export type SessionKeyOp = 'add' | 'revoke';

export interface ContractExecuteParams {
  contractId: string;
  method: string;
  args: any[];
}

export interface SimulationResult {
  fee: string;
  // ...other simulation fields
}

export class TransactionBuilder {
  private source: string;
  private ops: any[] = [];
  private fee: string = '10000';

  constructor(source: string) {
    this.source = source;
  }

  addSessionKey(sessionKey: string) {
    this.ops.push({ type: 'sessionKey', op: 'add', sessionKey });
    return this;
  }

  revokeSessionKey(sessionKey: string) {
    this.ops.push({ type: 'sessionKey', op: 'revoke', sessionKey });
    return this;
  }

  executeContract(params: ContractExecuteParams) {
    this.ops.push({ type: 'contractExecute', ...params });
    return this;
  }

  async simulate(): Promise<SimulationResult> {
    // Placeholder: simulate transaction for fee estimation
    return { fee: this.fee };
  }

  build(): Transaction | undefined {
    // TODO: Implement Soroban transaction construction or import correct builder
    // return buildSorobanTransaction(this.source, this.ops, this.fee);
    return undefined;
  }
}
