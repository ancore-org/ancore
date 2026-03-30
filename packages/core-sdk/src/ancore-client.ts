import { AccountContract, type InvocationArgs } from '@ancore/account-abstraction';

import { addSessionKey, type AddSessionKeyParams, type SessionKeyWriter } from './add-session-key';
import { BuilderValidationError } from './errors';
import {
  revokeSessionKey,
  type RevokeSessionKeyParams,
  type SessionKeyRevoker,
} from './revoke-session-key';

export interface AncoreClientOptions {
  accountContractId: string;
}

export class AncoreClient {
  private readonly accountContract: SessionKeyWriter & SessionKeyRevoker;

  constructor(options: AncoreClientOptions) {
    if (!options.accountContractId) {
      throw new BuilderValidationError(
        'accountContractId is required. Provide the C... contract ID of your deployed Ancore account contract.'
      );
    }

    this.accountContract = new AccountContract(options.accountContractId);
  }

  addSessionKey(params: AddSessionKeyParams): InvocationArgs {
    return addSessionKey(this.accountContract, params);
  }

  revokeSessionKey(params: RevokeSessionKeyParams): InvocationArgs {
    return revokeSessionKey(this.accountContract, params);
  }
}
