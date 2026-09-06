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
import { getHardwareWalletState } from '../stores/hardware-wallet';
import { formatLedgerError, signWithLedger } from '../security/ledger';

/**
 * How long a single relayer submission attempt may take (#1350).
 *
 * The smart-account send path had no bound at all, so a hung relayer
 * connection left the user staring at a spinner with no feedback and no idea
 * whether their money had moved. Fifteen seconds is generous for a POST that
 * only queues work, and short enough that a stalled connection becomes a
 * retry rather than a dead end.
 */
export const RELAYER_SUBMIT_TIMEOUT_MS = 15_000;

/**
 * Retry budget for relayer submission, matching the classic-account path's
 * `{ maxRetries: 4, exponential: true }` immediately below it.
 */
export const RELAYER_SUBMIT_MAX_RETRIES = 4;

/** Base delay for the exponential backoff between relayer attempts. */
export const RELAYER_RETRY_BASE_DELAY_MS = 500;

/** Bound on a transaction-status poll (#1351). */
export const TX_STATUS_TIMEOUT_MS = 8_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fetch` with an abort-based timeout.
 *
 * Follows the pattern already used by `probeServiceHealth` in `config/urls.ts`
 * rather than inventing a second one.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** True for failures where another attempt could plausibly succeed. */
function isRetriableSubmissionError(error: unknown): boolean {
  if (error instanceof Error) {
    // Abort = our own timeout firing; TypeError = fetch's network-level
    // failure (DNS, refused connection, dropped socket).
    return error.name === 'AbortError' || error.name === 'TypeError';
  }
  return false;
}

/**
 * Stable idempotency key for a submission.
 *
 * A retry must carry the *same* key as the attempt it replaces, or the relayer
 * cannot tell a retry from a second payment — so it is derived from the signed
 * payload rather than randomly generated. The payload already uniquely
 * identifies the transaction: it contains the source account's sequence
 * number, which is what makes a duplicate submission safe in the first place
 * (see the retry note in `submitTransaction`).
 */
function idempotencyKeyFor(signedPayload: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < signedPayload.length; index += 1) {
    hash ^= signedPayload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `aa-send-${hash.toString(16).padStart(8, '0')}-${signedPayload.length}`;
}

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
        network: stellarClient.getNetwork(),
      };
    },

    async authenticatePassword(password: string): Promise<boolean> {
      const response = await sendMessage('UNLOCK_WALLET', { password });
      return response.success;
    },

    async signTransaction(tx: SendTransactionDraft): Promise<string> {
      const unsignedXdr = await buildPaymentXdr(tx);
      const networkPassphrase = stellarClient.getNetworkPassphrase();
      const { signerMode, ledgerPublicKey } = getHardwareWalletState();

      // Hardware path: sign in the popup (WebHID user gesture). Never export seed.
      if (signerMode === 'ledger' && ledgerPublicKey) {
        try {
          return await signWithLedger(unsignedXdr, networkPassphrase);
        } catch (err) {
          throw new Error(formatLedgerError(err));
        }
      }

      const response = await sendMessage('SIGN_TRANSACTION', {
        xdr: unsignedXdr,
        networkPassphrase,
      });
      if ('error' in response) {
        throw new Error(response.error);
      }
      if ('requiresHardware' in response) {
        try {
          return await signWithLedger(unsignedXdr, networkPassphrase);
        } catch (err) {
          throw new Error(formatLedgerError(err));
        }
      }
      return response.signedXdr;
    },

    async submitTransaction(signedPayload: string): Promise<{ txId: string }> {
      if (isContractAccount) {
        try {
          // AA Execute -> relayer, with the same resilience the classic path
          // below has always had (#1350).
          //
          // Retrying a *payment* submission is only safe because of what is
          // being retried: the identical signed transaction, carrying the
          // source account's sequence number. The network accepts that
          // sequence exactly once, so a duplicate arriving after a timeout is
          // rejected rather than paid twice. The idempotency key lets the
          // relayer collapse the duplicate earlier and return the original
          // result instead of an error.
          //
          // Only network-level failures are retried — a timeout or a dropped
          // socket, where the request may never have been processed. An HTTP
          // error means the relayer answered, and repeating a request it has
          // already judged would just repeat the judgement.
          const relayerUrl = resolveRelayerUrl(environment);
          const idempotencyKey = idempotencyKeyFor(signedPayload);

          let lastNetworkError: unknown;
          let response: Response | undefined;

          for (let attempt = 0; attempt <= RELAYER_SUBMIT_MAX_RETRIES; attempt += 1) {
            try {
              response = await fetchWithTimeout(
                `${relayerUrl}/execute`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKey,
                  },
                  body: JSON.stringify({ transaction: signedPayload }),
                },
                RELAYER_SUBMIT_TIMEOUT_MS
              );
              break;
            } catch (error) {
              if (!isRetriableSubmissionError(error) || attempt === RELAYER_SUBMIT_MAX_RETRIES) {
                throw error;
              }
              lastNetworkError = error;
              await sleep(RELAYER_RETRY_BASE_DELAY_MS * 2 ** attempt);
            }
          }

          if (!response) {
            // Unreachable — the loop either breaks with a response or throws.
            throw lastNetworkError ?? new Error('Relayer submission failed');
          }

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

    /**
     * Poll a transaction's status.
     *
     * Distinguishes "not indexed yet" from "we could not ask" (#1351). Both
     * used to return `'pending'`, so an RPC endpoint that was simply down
     * looked exactly like a transaction still confirming — the UI would poll
     * forever showing pending, and the user had no way to tell that nobody
     * was actually checking anything.
     *
     * `'unreachable'` is not a claim about the transaction. It says only that
     * this attempt failed; the caller decides whether to keep trying, and can
     * tell the user why the answer is late.
     */
    async fetchTransactionStatus(txId: string): Promise<TxStatus> {
      const url = `${stellarClient.getRpcUrls()[0]?.replace('/soroban/rpc', '')}/transactions/${txId}`;

      let response: Response;
      try {
        response = await fetchWithTimeout(url, { method: 'GET' }, TX_STATUS_TIMEOUT_MS);
      } catch {
        // Timeout, DNS failure, refused connection — we do not know anything
        // about the transaction, and must not imply that we do.
        return 'unreachable';
      }

      if (response.ok) {
        return 'confirmed';
      }
      if (response.status === 404) {
        // A real answer: the network has not indexed it yet.
        return 'pending';
      }
      if (response.status >= 500) {
        // The endpoint answered, but about itself rather than the
        // transaction. Same epistemic position as a network failure.
        return 'unreachable';
      }
      return 'failed';
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
