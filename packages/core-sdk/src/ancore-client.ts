import { AccountContract, type InvocationArgs } from '@ancore/account-abstraction';
import type { Network } from '@ancore/types';
import { StrKey } from '@stellar/stellar-sdk';

import { addSessionKey, type AddSessionKeyParams, type SessionKeyWriter } from './add-session-key';
import {
  createWallet as createWalletOrchestration,
  type CreateWalletParams,
  type CreateWalletResult,
} from './create-wallet';
import { BuilderValidationError } from './errors';
import {
  refreshSessionKeyTtl,
  type RefreshSessionKeyTtlOptions,
  type RefreshSessionKeyTtlParams,
  type RefreshSessionKeyTtlResult,
  type SessionKeyTtlRefresher,
} from './refresh-session-key-ttl';
import {
  revokeSessionKey,
  type RevokeSessionKeyParams,
  type SessionKeyRevoker,
} from './revoke-session-key';
import { deriveContractId } from './wallet';

import { withRetry, type RetryOptions } from './utils/retry';

export interface AncoreClientOptions {
  accountContractId: string;
  /**
   * Default retry configuration for network and RPC calls.
   */
  retryOptions?: RetryOptions;
}

export interface CreateSmartAccountClientOptions {
  /**
   * Network used to derive the contract ID if not explicitly provided (default: 'testnet').
   */
  network?: Network;
  /**
   * Optional explicit accountContractId override (C...).
   */
  accountContractId?: string;
  /**
   * Default retry configuration for network and RPC calls.
   */
  retryOptions?: RetryOptions;
}

export class AncoreClient {
  readonly accountContractId: string;
  private readonly accountContract: SessionKeyWriter & SessionKeyRevoker & SessionKeyTtlRefresher;
  private readonly retryOptions?: RetryOptions;

  constructor(options: AncoreClientOptions) {
    if (!options.accountContractId) {
      throw new BuilderValidationError(
        'accountContractId is required. Provide the C... contract ID of your deployed Ancore account contract.'
      );
    }

    this.accountContractId = options.accountContractId;
    this.accountContract = new AccountContract(options.accountContractId);
    this.retryOptions = options.retryOptions;
  }

  /**
   * Convenience factory to create an initialized AncoreClient instance for a smart account.
   * Automatically looks up or derives the deterministic contract ID from the owner's public key.
   *
   * @param publicKey Owner's Stellar public key (G...) or contract ID (C...)
   * @param options Optional network and client configuration
   *
   * @example
   * ```typescript
   * const client = AncoreClient.createSmartAccount('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFXYORECK3P4YWPOY64KB');
   * console.log(client.accountContractId); // C...
   * ```
   */
  static createSmartAccount(
    publicKey: string,
    options?: CreateSmartAccountClientOptions
  ): AncoreClient {
    if (!publicKey) {
      throw new BuilderValidationError('publicKey is required to create a smart account client.');
    }

    let contractId = options?.accountContractId;
    if (!contractId) {
      if (publicKey.startsWith('C') && StrKey.isValidContract(publicKey)) {
        contractId = publicKey;
      } else {
        const network = options?.network ?? 'testnet';
        contractId = deriveContractId(publicKey, network);
      }
    }

    return new AncoreClient({
      accountContractId: contractId,
      retryOptions: options?.retryOptions,
    });
  }

  /**
   * Execute an asynchronous network call with the client's configured retry policy.
   *
   * @param fn Function to execute
   * @param overrideOptions Optional override for this specific invocation
   */
  withRetry<T>(fn: () => Promise<T>, overrideOptions?: RetryOptions): Promise<T> {
    return withRetry(fn, {
      ...this.retryOptions,
      ...overrideOptions,
    });
  }

  /**
   * Creates a new Ancore wallet by generating a fresh BIP39 mnemonic, deriving
   * an Ed25519 keypair via BIP-44 HD derivation, and optionally encrypting the
   * mnemonic with the provided password.
   *
   * @example
   * ```typescript
   * const client = new AncoreClient({ accountContractId: 'C...' });
   * const wallet = await client.createWallet({ password: 'hunter2' });
   * // wallet.publicKey  → G…  (safe to persist)
   * // wallet.contractId → C…  (safe to persist)
   * // wallet.encryptedMnemonic → persist this; do NOT persist wallet.secretKey
   * ```
   */
  createWallet(params?: CreateWalletParams): Promise<CreateWalletResult> {
    return createWalletOrchestration(params);
  }

  addSessionKey(params: AddSessionKeyParams): InvocationArgs {
    return addSessionKey(this.accountContract, params);
  }

  revokeSessionKey(params: RevokeSessionKeyParams): InvocationArgs {
    return revokeSessionKey(this.accountContract, params);
  }

  refreshSessionKeyTtl(
    params: RefreshSessionKeyTtlParams,
    options?: RefreshSessionKeyTtlOptions
  ): InvocationArgs | Promise<RefreshSessionKeyTtlResult> {
    if (!options) {
      return refreshSessionKeyTtl(this.accountContract, params);
    }

    const mergedOptions: RefreshSessionKeyTtlOptions = {
      ...options,
      retryOptions: {
        ...this.retryOptions,
        ...options.retryOptions,
      },
    };

    return refreshSessionKeyTtl(this.accountContract, params, mergedOptions);
  }
}

/**
 * Convenience factory to create an initialized AncoreClient instance for a smart account.
 * Automatically looks up or derives the deterministic contract ID from the owner's public key.
 *
 * @param publicKey Owner's Stellar public key (G...) or contract ID (C...)
 * @param options Optional network and client configuration
 */
export function createSmartAccount(
  publicKey: string,
  options?: CreateSmartAccountClientOptions
): AncoreClient {
  return AncoreClient.createSmartAccount(publicKey, options);
}
