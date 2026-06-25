/**
 * Soroban transaction simulation helpers for @ancore/stellar.
 */

import { rpc, TransactionBuilder } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';

export interface SorobanResourceLimits {
  cpuInsn: number;
  memBytes: number;
  minResourceFee?: string;
}

export interface ParsedSimulationResult {
  fee: string;
  resourceLimits: SorobanResourceLimits;
  authEntries: string[];
  footprint: string;
  error?: string;
}

const EMPTY_RESOURCE_LIMITS: SorobanResourceLimits = {
  cpuInsn: 0,
  memBytes: 0,
};

function stroopsToXlm(stroops: string): string {
  const value = Number(stroops);
  if (!Number.isFinite(value)) {
    return '0.0000000';
  }
  return (value / 10_000_000).toFixed(7);
}

function readBaseFee(unsignedXdr: string, networkPassphrase: string): string {
  try {
    const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase) as Transaction;
    const perOpFee = BigInt(tx.fee ?? '100');
    const operationCount = BigInt(tx.operations.length || 1);
    return (perOpFee * operationCount).toString();
  } catch {
    return '100';
  }
}

function parseTransaction(unsignedXdr: string, networkPassphrase: string): Transaction | null {
  try {
    return TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase) as Transaction;
  } catch {
    return null;
  }
}

function requiresSorobanSimulation(transaction: Transaction): boolean {
  return transaction.operations.some((operation) => operation.type === 'invokeHostFunction');
}

function classicSimulationResult(transaction: Transaction): ParsedSimulationResult {
  const perOpFee = BigInt(transaction.fee ?? '100');
  const totalStroops = (perOpFee * BigInt(transaction.operations.length || 1)).toString();

  return {
    fee: stroopsToXlm(totalStroops),
    resourceLimits: EMPTY_RESOURCE_LIMITS,
    authEntries: [],
    footprint: '',
  };
}

function extractAuthEntries(response: rpc.Api.SimulateTransactionSuccessResponse): string[] {
  // In stellar-sdk v13+, auth entries live on result (singular), not results
  const result = response.result;
  if (!result) {
    return [];
  }
  return (result.auth ?? []).map((entry) => entry.toXDR('base64'));
}

function extractFootprint(response: rpc.Api.SimulateTransactionSuccessResponse): string {
  const txData = response.transactionData;
  if (!txData) {
    return '';
  }

  try {
    // build() returns the XDR SorobanTransactionData; serialize the whole thing
    return txData.build().toXDR('base64');
  } catch {
    return '';
  }
}

function parseResourceLimits(
  response: rpc.Api.SimulateTransactionSuccessResponse
): SorobanResourceLimits {
  // stellar-sdk v13 removed the top-level `cost` field; resource counts live
  // inside the transaction data's resources XDR object
  try {
    const resources = response.transactionData.build().resources();
    return {
      cpuInsn: Number(resources.instructions()),
      memBytes: Number(resources.readBytes()) + Number(resources.writeBytes()),
      minResourceFee: response.minResourceFee,
    };
  } catch {
    return {
      cpuInsn: 0,
      memBytes: 0,
      minResourceFee: response.minResourceFee,
    };
  }
}

function simulationErrorMessage(response: rpc.Api.SimulateTransactionErrorResponse): string {
  if (response.error) {
    return response.error;
  }

  if (response.events && response.events.length > 0) {
    return 'Transaction simulation failed';
  }

  return 'Transaction simulation failed';
}

/**
 * Parse a Soroban RPC simulateTransaction response into wallet-friendly fields.
 */
export function parseSimulationResponse(
  response: rpc.Api.SimulateTransactionResponse,
  unsignedXdr: string,
  networkPassphrase: string
): ParsedSimulationResult {
  if (rpc.Api.isSimulationError(response)) {
    return {
      fee: '0.0000000',
      resourceLimits: EMPTY_RESOURCE_LIMITS,
      authEntries: [],
      footprint: '',
      error: simulationErrorMessage(response),
    };
  }

  if (rpc.Api.isSimulationRestore(response)) {
    return {
      fee: '0.0000000',
      resourceLimits: EMPTY_RESOURCE_LIMITS,
      authEntries: [],
      footprint: '',
      error: 'Contract state must be restored before this transaction can execute',
    };
  }

  if (!rpc.Api.isSimulationSuccess(response)) {
    return {
      fee: '0.0000000',
      resourceLimits: EMPTY_RESOURCE_LIMITS,
      authEntries: [],
      footprint: '',
      error: 'Unexpected simulation response',
    };
  }

  const baseFee = readBaseFee(unsignedXdr, networkPassphrase);
  const minResourceFee = response.minResourceFee ?? '0';
  const totalFeeStroops = (BigInt(baseFee) + BigInt(minResourceFee)).toString();

  return {
    fee: stroopsToXlm(totalFeeStroops),
    resourceLimits: parseResourceLimits(response),
    authEntries: extractAuthEntries(response),
    footprint: extractFootprint(response),
  };
}

/**
 * Simulate or estimate fees for an unsigned transaction envelope.
 * Soroban invoke operations use Soroban RPC; classic operations use the
 * envelope fee because RPC rejects unsupported operation types.
 */
export function simulateUnsignedTransaction(
  unsignedXdr: string,
  networkPassphrase: string,
  rpcSimulate: (transaction: Transaction) => Promise<rpc.Api.SimulateTransactionResponse>
): Promise<ParsedSimulationResult> {
  const transaction = parseTransaction(unsignedXdr, networkPassphrase);
  if (!transaction) {
    return Promise.resolve({
      fee: '0.0000000',
      resourceLimits: EMPTY_RESOURCE_LIMITS,
      authEntries: [],
      footprint: '',
      error: 'Invalid transaction XDR',
    });
  }

  if (!requiresSorobanSimulation(transaction)) {
    return Promise.resolve(classicSimulationResult(transaction));
  }

  return rpcSimulate(transaction).then((response) =>
    parseSimulationResponse(response, unsignedXdr, networkPassphrase)
  );
}
