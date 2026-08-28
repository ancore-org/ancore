import { rpc, TransactionBuilder, Transaction, xdr } from '@stellar/stellar-sdk';
import { SimulationFailedError, StellarClient } from '@ancore/stellar';
import type { Network } from '@ancore/types';
import { NETWORK_PASSPHRASES } from '@ancore/wallet-shared';
import type { TransactionSubmitterContract, TransactionSubmissionResult } from '../types';
import { getEnv } from '../config/env';

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

    let gasUsed = 0;
    if (response && typeof response === 'object') {
      if ('fee_charged' in response && (response as any).fee_charged !== undefined) {
        const parsed = Number.parseInt(String((response as any).fee_charged), 10);
        if (!Number.isNaN(parsed)) {
          gasUsed = parsed;
        }
      } else if ('result_xdr' in response && typeof (response as any).result_xdr === 'string') {
        try {
          const txResult = xdr.TransactionResult.fromXDR((response as any).result_xdr, 'base64');
          const parsed = Number.parseInt(txResult.feeCharged().toString(), 10);
          if (!Number.isNaN(parsed)) {
            gasUsed = parsed;
          }
        } catch {
          gasUsed = Number.parseInt(String(transaction.fee), 10) || 0;
        }
      } else {
        gasUsed = Number.parseInt(String(transaction.fee), 10) || 0;
      }
    } else {
      gasUsed = Number.parseInt(String(transaction.fee), 10) || 0;
    }

    return {
      transactionHash: response.hash,
      gasUsed,
    };
  }

  async isHealthy(): Promise<{ healthy: boolean; latencyMs?: number }> {
    const started = Date.now();
    const healthy = await this.client.isHealthy();
    return { healthy, latencyMs: Date.now() - started };
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
