import { AccountContract, type InvocationArgs } from '@ancore/account-abstraction';

import { addSessionKey, type AddSessionKeyParams, type SessionKeyWriter } from './add-session-key';
import { BuilderValidationError } from './errors';

export interface AncoreClientOptions {
    accountContractId: string;
}

export class AncoreClient {
    private readonly accountContract: SessionKeyWriter;

    constructor(options: AncoreClientOptions) {
        if (!options.accountContractId) {
            throw new BuilderValidationError(
                'accountContractId is required. Provide the C... contract ID of your deployed Ancore account contract.'
            );
        }

        this.accountContract = new AccountContract(options.accountContractId);
    }

    addSessionKey (params: AddSessionKeyParams): InvocationArgs {
        return addSessionKey(this.accountContract, params);
    }
}
