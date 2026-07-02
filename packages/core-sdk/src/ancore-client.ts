import { AccountContract, type InvocationArgs } from '@ancore/account-abstraction';

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

export interface AncoreClientOptions {
  accountContractId: string;
}

export class AncoreClient {
  private readonly accountContract: SessionKeyWriter & SessionKeyRevoker & SessionKeyTtlRefresher;

  constructor(options: AncoreClientOptions) {
    if (!options.accountContractId) {
      throw new BuilderValidationError(
        'accountContractId is required. Provide the C... contract ID of your deployed Ancore account contract.'
      );
    }

    this.accountContract = new AccountContract(options.accountContractId);
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
    return options
      ? refreshSessionKeyTtl(this.accountContract, params, options)
      : refreshSessionKeyTtl(this.accountContract, params);
  }
}
