import {
  initializeSmartAccount,
  type InitializeSmartAccountOptions,
  type InitializeSmartAccountResult,
} from './initialize-smart-account';

export type AncoreClientOptions<
  TOperation = unknown,
  TTx = unknown,
  TTxResult = unknown,
> = InitializeSmartAccountOptions<TOperation, TTx, TTxResult>;

export class AncoreClient<TOperation = unknown, TTx = unknown, TTxResult = unknown> {
  constructor(private readonly options: AncoreClientOptions<TOperation, TTx, TTxResult>) {}

  async initializeSmartAccount(
    contractId: string
  ): Promise<InitializeSmartAccountResult<TTxResult>> {
    return initializeSmartAccount(contractId, this.options);
  }
}
