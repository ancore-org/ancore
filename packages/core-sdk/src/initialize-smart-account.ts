import { BuilderValidationError } from './errors';

export interface InvocationArgs {
  method: string;
  args: unknown[];
}

export interface SmartAccountInitializerContract<TOperation = unknown> {
  initialize(ownerPublicKey: string): InvocationArgs;
  buildInvokeOperation(invocation: InvocationArgs): TOperation;
}

export interface SmartAccountInitializerBuilder<TOperation = unknown, TTx = unknown> {
  addOperation(operation: TOperation): SmartAccountInitializerBuilder<TOperation, TTx>;
  build(): Promise<TTx>;
}

export type InitializeSmartAccountResult<TTxResult = unknown> =
  | {
      kind: 'contractAddress';
      contractAddress: string;
    }
  | {
      kind: 'transactionResult';
      txResult: TTxResult;
    };

export interface InitializeSmartAccountOptions<
  TOperation = unknown,
  TTx = unknown,
  TTxResult = unknown,
> {
  ownerPublicKey: string;
  createTransactionBuilder: (contractId: string) => SmartAccountInitializerBuilder<TOperation, TTx>;
  createAccountContract?: (contractId: string) => SmartAccountInitializerContract<TOperation>;
  submitTransaction?: (transaction: TTx) => Promise<TTxResult>;
}

const CONTRACT_ID_STRKEY_REGEX = /^C[A-Z0-9]{55}$/;
const CONTRACT_ID_HEX_REGEX = /^[A-Fa-f0-9]{64}$/;

export function validateContractId(contractId: string): string {
  if (typeof contractId !== 'string') {
    throw new BuilderValidationError('contractId must be a string.');
  }

  const normalized = contractId.trim();
  if (!normalized) {
    throw new BuilderValidationError('contractId is required.');
  }

  const isSupportedFormat =
    CONTRACT_ID_STRKEY_REGEX.test(normalized) || CONTRACT_ID_HEX_REGEX.test(normalized);

  if (!isSupportedFormat) {
    throw new BuilderValidationError(
      'Invalid contractId format. Expected a C... contract address or 64-char hex ID.'
    );
  }

  return normalized;
}

export async function initializeSmartAccount<
  TOperation = unknown,
  TTx = unknown,
  TTxResult = unknown,
>(
  contractId: string,
  options: InitializeSmartAccountOptions<TOperation, TTx, TTxResult>
): Promise<InitializeSmartAccountResult<TTxResult>> {
  const validContractId = validateContractId(contractId);
  const createAccountContract = options.createAccountContract ?? defaultCreateAccountContract;

  const accountContract = createAccountContract(validContractId);
  const invocation = accountContract.initialize(options.ownerPublicKey);
  const operation = accountContract.buildInvokeOperation(invocation);

  const txBuilder = options.createTransactionBuilder(validContractId);
  txBuilder.addOperation(operation);
  const builtTransaction = await txBuilder.build();

  if (options.submitTransaction) {
    const txResult = await options.submitTransaction(builtTransaction);
    return {
      kind: 'transactionResult',
      txResult,
    };
  }

  return {
    kind: 'contractAddress',
    contractAddress: validContractId,
  };
}

function defaultCreateAccountContract<TOperation = unknown>(
  contractId: string
): SmartAccountInitializerContract<TOperation> {
  // Lazy-load to keep tests independent from workspace package type resolution.
  // In normal runtime, this resolves to @ancore/account-abstraction's AccountContract.
  const { AccountContract } = require('@ancore/account-abstraction') as {
    AccountContract: new (id: string) => SmartAccountInitializerContract<TOperation>;
  };

  return new AccountContract(contractId);
}
