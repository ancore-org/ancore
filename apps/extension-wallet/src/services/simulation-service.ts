/**
 * Soroban transaction simulation for the extension send review flow.
 *
 * Standalone module — builds unsigned XDR, calls Soroban RPC via @ancore/stellar,
 * and returns fee estimates plus contract effects for ReviewScreen.
 */

import { createStellarClient } from '@ancore/stellar';
import type { SorobanResourceLimits } from '@ancore/stellar';
import type { StellarNetwork } from '@ancore/wallet-shared';

export type { SorobanResourceLimits };

export interface SimulationResult {
  fee: string;
  resourceLimits: SorobanResourceLimits;
  authEntries: string[];
  footprint: string;
  error?: string;
}

export interface SimulateTransactionOptions {
  /** Injectable client for unit tests, or the caller's configured StellarClient. */
  client?: {
    simulateTransaction(unsignedXdr: string): Promise<SimulationResult>;
  };
}

/**
 * Simulate an unsigned transaction envelope against Soroban RPC.
 *
 * On failure the returned object includes `error` — callers decide whether to
 * block or warn. No exceptions are thrown for simulation failures.
 */
export async function simulateTransaction(
  unsignedXdr: string,
  network: StellarNetwork,
  options?: SimulateTransactionOptions
): Promise<SimulationResult> {
  if (options?.client) {
    return options.client.simulateTransaction(unsignedXdr);
  }

  const stellarClient = createStellarClient(network);
  return stellarClient.simulateTransaction(unsignedXdr);
}
