import type { xdr } from '@stellar/stellar-sdk';

type SorobanData = xdr.SorobanTransactionData;

/**
 * Result of a successful Soroban simulation: fee estimates and resource footprint.
 */
export interface SimulationResult {
  fee: string;
  operationCount: number;
  minResourceFee?: string;
  transactionData?: SorobanData;
}

/**
 * Shape of a simulation error response from the Soroban RPC server.
 * Exposed so consumers can narrow on `error` / `message` without casting to `any`.
 */
export interface SimulationError {
  error?: string;
  message?: string;
  result?: {
    retval?: xdr.ScVal;
  };
}
