import { rpc, TransactionBuilder, Transaction } from '@stellar/stellar-sdk';
import { SimulationFailedError, StellarClient } from '@ancore/stellar';
import type { Network } from '@ancore/types';
import type { TransactionSubmitterContract, TransactionSubmissionResult } from '../types';

const NETWORK_PASSPHRASES: Record<Network, string> = {
  testnet: 'Test SDF Network ; September 2015',
  mainnet: 'Public Global Stellar Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
  local: 'Standalone Network ; February 2017',
};

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
      gasUsed: Number.parseInt(String(transaction.fee), 10) || 0,
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
  const network = resolveStellarNetwork(process.env.STELLAR_NETWORK);
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE;
  return new StellarTransactionSubmitter({
    network,
    ...(networkPassphrase ? { networkPassphrase } : {}),
  });
}
