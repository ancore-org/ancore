import { StellarClient, createStellarClient } from '@ancore/stellar';
import { buildSignedRelayPayload, resolveRelayerBaseUrl } from '@ancore/core-sdk';
import { createWalletApiRelaySigner } from './relay-signer';
import { AuthRequiredError } from '../auth';
import { NETWORK_PASSPHRASES } from '@ancore/wallet-shared';
import {
  Operation,
  Asset,
  TransactionBuilder,
  Account,
  Memo,
  TimeoutInfinite,
} from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SendMethodName = 'wallet-api' | 'relayer';

export interface FeeEstimate {
  /** Estimated network fee in XLM. */
  baseFee: string;
  /** Minimum balance needed (base reserve + fee). */
  minBalance: string;
}

export interface SendParams {
  recipient: string;
  amount: string;
  asset?: { code: string; issuer: string } | 'native';
  memo?: string;
}

export interface SendResult {
  status: 'submitted' | 'pending';
  /** Stellar transaction hash (for wallet-api path) or job ID (for relayer). */
  hash: string;
  signedXdr?: string;
}

export interface SendStrategy {
  readonly name: SendMethodName;
  isAvailable(): Promise<boolean>;
  estimateFee(params: SendParams): Promise<FeeEstimate>;
  send(params: SendParams): Promise<SendResult>;
}

export interface SendStrategyDeps {
  /** Network for StellarClient construction. */
  network: 'testnet' | 'mainnet' | 'futurenet' | 'local';
  /** Auth token for relayer requests. */
  getAuthToken?: () => string | Promise<string>;
}

// ---------------------------------------------------------------------------
// WalletApiSendStrategy
// ---------------------------------------------------------------------------

/**
 * Signs via the Ancore extension wallet-api bridge.
 * Builds XDR → signs via extension → submits to Stellar network.
 */
export class WalletApiSendStrategy implements SendStrategy {
  readonly name = 'wallet-api' as const;

  private readonly network: SendStrategyDeps['network'];

  constructor(deps: SendStrategyDeps) {
    this.network = deps.network;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const walletApi = await import('@ancore/wallet-api');
      return await walletApi.isConnected();
    } catch {
      return false;
    }
  }

  async estimateFee(_params: SendParams): Promise<FeeEstimate> {
    const client = this.createClient();
    const ops = [this.buildPaymentOp(_params)];
    const fee = await this.estimateFeeFromNetwork(client, ops);
    return fee;
  }

  async send(params: SendParams): Promise<SendResult> {
    const walletApi = await import('@ancore/wallet-api');
    const client = this.createClient();

    // 1. Load source account for sequence number
    const { smartAccountId } = await walletApi.getAddress();
    const sourceAccount = await client.getAccount(smartAccountId);

    // 2. Build unsigned transaction
    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: '100000', // Will be overwritten by simulation
      networkPassphrase: this.getNetworkPassphrase(),
    });
    txBuilder.addOperation(this.buildPaymentOp(params));
    if (params.memo) {
      txBuilder.addMemo(Memo.text(params.memo));
    }
    const unsignedTx = txBuilder.build();
    const unsignedXdr = unsignedTx.toXDR();

    // 3. Sign via extension
    const { signedXdr } = await walletApi.signTransaction({
      xdr: unsignedXdr,
      networkPassphrase: this.getNetworkPassphrase(),
    });

    // 4. Submit to network
    const signedTx = TransactionBuilder.fromXDR(
      signedXdr,
      this.getNetworkPassphrase()
    ) as Transaction;
    const response = await client.submitTransaction(signedTx);

    return {
      status: 'submitted',
      hash: response.hash,
      signedXdr,
    };
  }

  private createClient(): StellarClient {
    return createStellarClient(this.network);
  }

  private buildPaymentOp(params: SendParams) {
    const asset = resolveAsset(params.asset);
    return Operation.payment({
      destination: params.recipient,
      asset,
      amount: params.amount,
    });
  }

  private getNetworkPassphrase(): string {
    return NETWORK_PASSPHRASES[this.network] ?? NETWORK_PASSPHRASES.testnet;
  }

  private async estimateFeeFromNetwork(
    client: StellarClient,
    ops: ReturnType<typeof Operation.payment>[]
  ): Promise<FeeEstimate> {
    try {
      const passphrase = this.getNetworkPassphrase();
      const tempAccount = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      );
      const txBuilder = new TransactionBuilder(tempAccount, {
        fee: '100000',
        networkPassphrase: passphrase,
      });
      for (const op of ops) {
        txBuilder.addOperation(op);
      }
      // Required by stellar-sdk: build() throws without explicit timebounds.
      // Omitting this made every estimate fall through to the static default.
      txBuilder.setTimeout(TimeoutInfinite);
      const tx = txBuilder.build();
      const result = await client.simulateTransaction(tx.toXDR());

      if ('fee' in result) {
        if (!Number.isFinite(Number(result.fee))) {
          throw new Error('fee unavailable');
        }
        return {
          baseFee: result.fee,
          minBalance: calculateMinBalance(result.fee),
        };
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'fee unavailable') {
        throw err;
      }
      // Fall through to default
    }

    return { baseFee: '0.0000100', minBalance: '0.0050100' };
  }
}

// ---------------------------------------------------------------------------
// RelayerSendStrategy
// ---------------------------------------------------------------------------

/**
 * Sends via the relayer using a session key.
 * Builds AA invocation → POST /relay/execute → returns job ID for polling.
 */
export class RelayerSendStrategy implements SendStrategy {
  readonly name = 'relayer' as const;

  private readonly getAuthToken: SendStrategyDeps['getAuthToken'];
  private readonly fetchImpl: typeof fetch;

  constructor(deps: SendStrategyDeps) {
    this.getAuthToken = deps.getAuthToken;
    this.fetchImpl = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : globalThis.fetch;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = resolveRelayerBaseUrl();
      const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async estimateFee(_params: SendParams): Promise<FeeEstimate> {
    // Relayer fee estimation: use the same base fee since the relayer
    // absorbs the actual network fee into its operating cost.
    return { baseFee: '0.0000100', minBalance: '0.0050100' };
  }

  async send(params: SendParams): Promise<SendResult> {
    const baseUrl = resolveRelayerBaseUrl();
    if (!this.getAuthToken) {
      throw new AuthRequiredError();
    }
    const token = await this.getAuthToken();

    const signer = await createWalletApiRelaySigner();
    const payload = await buildSignedRelayPayload(params.recipient, params.amount, signer);
    const idempotencyKey = `dashboard-send-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const response = await this.fetchImpl(`${baseUrl}/relay/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let message = `Relayer request failed (${response.status})`;
      try {
        const body = (await response.json()) as {
          message?: string;
          error?: string | { message?: string };
        };
        const rawError = body.error;
        const errorStr =
          typeof rawError === 'string'
            ? rawError
            : rawError && typeof rawError === 'object'
              ? rawError.message
              : undefined;
        message = body.message ?? errorStr ?? message;
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    const body = (await response.json()) as {
      success?: boolean;
      jobId?: string;
      txHash?: string;
      error?: { message?: string };
    };

    if (body.success === false) {
      throw new Error(body.error?.message ?? 'Relayer execution failed');
    }

    return {
      status: 'pending',
      hash: body.jobId ?? body.txHash ?? `relayer-${idempotencyKey}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveAsset(asset: SendParams['asset']): Asset {
  if (!asset || asset === 'native') {
    return Asset.native();
  }
  return new Asset(asset.code, asset.issuer);
}

function calculateMinBalance(feeXlm: string): string {
  const feeNum = parseFloat(feeXlm);
  if (!Number.isFinite(feeNum)) {
    throw new Error('fee unavailable');
  }
  // Base reserve is 0.5 XLM + fee
  return (0.5 + feeNum).toFixed(7);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createSendStrategy(method: SendMethodName, deps: SendStrategyDeps): SendStrategy {
  switch (method) {
    case 'wallet-api':
      return new WalletApiSendStrategy(deps);
    case 'relayer':
      return new RelayerSendStrategy(deps);
  }
}
