import type {
  SendService,
  SendTransactionDraft,
  SendFormValues,
  FeeEstimate,
  TxStatus,
  UiSimulationResult,
} from '../hooks/useSendTransaction';
import type { StellarClient } from '@ancore/stellar';
import { sendMessage } from '../messaging';
import { resolveRelayerUrl } from '../config/urls';
import { Account, Asset, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { getErrorUserMessage } from '../errors/error-handler';
import { simulateTransaction as simulateSorobanTransaction } from './simulation-service';
import type { StellarNetwork } from '@ancore/wallet-shared';
export interface ProductionSendServiceOptions {
  stellarClient: StellarClient;
  accountAddress: string;
  isContractAccount?: boolean;
  environment?: string;
}

export function createProductionSendService(options: ProductionSendServiceOptions): SendService {
  const { stellarClient, accountAddress, isContractAccount, environment = 'production' } = options;

  async function buildPaymentXdr(tx: SendTransactionDraft): Promise<string> {
    const accountResponse = await stellarClient.getAccount(accountAddress);
    const account = new Account(accountResponse.id, accountResponse.sequence);

    // If a fee is provided from simulation, we convert it to stroops. Otherwise default 10000.
    const feeStroops = tx.fee ? Math.ceil(Number(tx.fee.totalFee) * 1e7).toString() : '10000';

    const builder = new TransactionBuilder(account, {
      fee: feeStroops,
      networkPassphrase: stellarClient.getNetworkPassphrase(),
    });

    builder.addOperation(
      Operation.payment({
        destination: tx.to,
        asset: Asset.native(),
        amount: tx.amount,
      })
    );

    builder.setTimeout(300);
    return builder.build().toXDR();
  }

  return {
    async estimateFee(_input: SendFormValues): Promise<FeeEstimate> {
      // Return a basic fee estimate. In a full implementation, this might call simulate.
      return {
        baseFee: '0.0000100',
        totalFee: '0.0000100',
        network: stellarClient.getNetwork() as any,
      };
    },

    async authenticatePassword(password: string): Promise<boolean> {
      const response = await sendMessage('UNLOCK_WALLET', { password });
      return response.success;
    },

    async signTransaction(tx: SendTransactionDraft): Promise<string> {
      const unsignedXdr = await buildPaymentXdr(tx);
      const response = await sendMessage('SIGN_TRANSACTION', {
        xdr: unsignedXdr,
        networkPassphrase: stellarClient.getNetworkPassphrase(),
      });
      if ('error' in response) {
        throw new Error(response.error);
      }
      return response.signedXdr;
    },

    async submitTransaction(signedPayload: string): Promise<{ txId: string }> {
      if (isContractAccount) {
        try {
          // AA Execute -> relayer
          const relayerUrl = resolveRelayerUrl(environment);
          const response = await fetch(`${relayerUrl}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction: signedPayload }),
          });

          if (!response.ok) {
            let errorMsg = 'Unknown error';
            try {
              const data = await response.json();
              errorMsg = data.error || data.message || `HTTP ${response.status}`;
            } catch {
              errorMsg = `HTTP ${response.status}`;
            }
            throw new Error(`Relayer submission failed: ${errorMsg}`);
          }

          const data = await response.json();
          if (!data.hash && !data.txId) {
            throw new Error('Relayer submission failed: Missing transaction ID in response');
          }
          return { txId: data.hash || data.txId };
        } catch (error) {
          const userMsg = getErrorUserMessage(error);
          throw new Error(`${userMsg.title}: ${userMsg.description}`);
        }
      } else {
        try {
          // Classic -> Horizon via @ancore/stellar with 504 retry (max 5 attempts, exponential)
          const response = await stellarClient.submitTransaction(signedPayload, {
            retryOptions: { maxRetries: 4, exponential: true },
          });
          return { txId: response.hash };
        } catch (error) {
          const userMsg = getErrorUserMessage(error);
          throw new Error(`${userMsg.title}: ${userMsg.description}`);
        }
      }
    },

    async fetchTransactionStatus(txId: string): Promise<TxStatus> {
      // In production, we might poll the transaction from Horizon or Indexer
      try {
        const url = `${stellarClient.getRpcUrls()[0]?.replace('/soroban/rpc', '')}/transactions/${txId}`;
        const response = await fetch(url);
        if (response.ok) {
          return 'confirmed';
        } else if (response.status === 404) {
          return 'pending';
        }
        return 'failed';
      } catch {
        return 'pending'; // assume pending on network error
      }
    },

    async simulateTransaction(tx: SendTransactionDraft): Promise<UiSimulationResult> {
      const unsignedXdr = await buildPaymentXdr(tx);
      const result = await simulateSorobanTransaction(
        unsignedXdr,
        stellarClient.getNetwork() as StellarNetwork,
        {
          client: stellarClient,
        }
      );

      if (result.error) {
        return {
          fee: result.fee,
          resourceLimits: result.resourceLimits,
          authEntries: result.authEntries,
          footprint: result.footprint,
          error: result.error,
        };
      }

      return {
        fee: result.fee,
        resourceLimits: result.resourceLimits,
        authEntries: result.authEntries,
        footprint: result.footprint,
        outcome: 'success',
      };
    },
  };
}
