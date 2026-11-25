import { rpc, TransactionBuilder, Transaction, xdr } from '@stellar/stellar-sdk';
import { SimulationFailedError, StellarClient } from '@ancore/stellar';
import type { Network } from '@ancore/types';
import { NETWORK_PASSPHRASES } from '@ancore/wallet-shared';
import type { TransactionSubmitterContract, TransactionSubmissionResult } from '../types';
import { getEnv } from '../config/env';

type SubmissionFeeDetails = {
  fee_charged?: string | number;
  result_xdr?: string;
};

function hasSubmissionFeeDetails(response: unknown): response is SubmissionFeeDetails {
  if (typeof response !== 'object' || response === null) {
    return false;
  }

  return (
    (!('fee_charged' in response) ||
      response.fee_charged === undefined ||
      typeof response.fee_charged === 'string' ||
      typeof response.fee_charged === 'number') &&
    (!('result_xdr' in response) ||
      response.result_xdr === undefined ||
      typeof response.result_xdr === 'string')
  );
}

export interface StellarSubmitterConfig {
  network: Network;
  networkPassphrase?: string;
}

/**
 * Submits pre-signed Soroban transactions via Horizon using @ancore/stellar.
 */
export class StellarTransactionSubmitter implements TransactionSubmitterContract {
  private readonly client: StellarClient;
  private readonly networkPassphrase: string;

  constructor(config: StellarSubmitterConfig, client?: StellarClient) {
    this.networkPassphrase = config.networkPassphrase ?? NETWORK_PASSPHRASES[config.network];
    this.client =
      client ??
      new StellarClient({ network: config.network, networkPassphrase: this.networkPassphrase });
  }

  async simulateAndAssembleTransaction(
    signedXdr: string
  ): Promise<{ assembledXdr: string; gasUsed: number }> {
    const transaction = this.parseTransaction(signedXdr);
    const simulation = await this.client.simulateTransaction(transaction);

    if (rpc.Api.isSimulationError(simulation)) {
      throw new SimulationFailedError(simulation.error);
    }

    if (rpc.Api.isSimulationRestore(simulation)) {
      throw new SimulationFailedError(
        'Transaction simulation requires state restoration before submission'
      );
    }

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new SimulationFailedError(
        'Unexpected simulation response shape. Please check Soroban RPC health.'
      );
    }

    const assembled = rpc.assembleTransaction(transaction, simulation).build();
    return {
      assembledXdr: assembled.toXDR(),
      gasUsed: Number.parseInt(String(assembled.fee), 10) || 0,
    };
  }

  async submitSignedTransaction(signedXdr: string): Promise<TransactionSubmissionResult> {
    const transaction = this.parseTransaction(signedXdr);
    const response = await this.client.submitTransaction(transaction);

    return {
      transactionHash: response.hash,
      gasUsed: this.resolveGasUsed(response, transaction),
    };
  }

  async isHealthy(): Promise<{ healthy: boolean; latencyMs?: number }> {
    const started = Date.now();
    const healthy = await this.client.isHealthy();
    return { healthy, latencyMs: Date.now() - started };
  }

  private resolveGasUsed(response: unknown, transaction: Transaction): number {
    if (hasSubmissionFeeDetails(response)) {
      if (response.fee_charged !== undefined) {
        return Number.parseInt(String(response.fee_charged), 10) || 0;
      }

      if (response.result_xdr !== undefined) {
        try {
          const result = xdr.TransactionResult.fromXDR(response.result_xdr, 'base64');
          return Number.parseInt(result.feeCharged().toString(), 10) || 0;
        } catch {
          // Use the transaction fee when Horizon returns malformed result XDR.
        }
      }
    }

    return Number.parseInt(transaction.fee, 10) || 0;
  }

  private parseTransaction(signedXdr: string): Transaction {
    return TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase) as Transaction;
  }
}

export function resolveStellarNetwork(value: string | undefined): Network {
  if (value === 'mainnet' || value === 'local' || value === 'testnet' || value === 'futurenet') {
    return value;
  }
  return 'testnet';
}

export function createStellarSubmitterFromEnv(): StellarTransactionSubmitter {
  // STELLAR_NETWORK is validated as an enum by src/config/env.ts, so an
  // unrecognised value fails at boot instead of silently becoming `testnet`.
  const { STELLAR_NETWORK: network, STELLAR_NETWORK_PASSPHRASE: networkPassphrase } = getEnv();
  return new StellarTransactionSubmitter({
    network,
    ...(networkPassphrase ? { networkPassphrase } : {}),
  });
}
