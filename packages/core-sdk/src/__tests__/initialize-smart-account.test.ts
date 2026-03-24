import {
  AncoreClient,
  BuilderValidationError,
  initializeSmartAccount,
  type SmartAccountInitializerBuilder,
  type SmartAccountInitializerContract,
} from '../index';

const OWNER_PUBLIC_KEY = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';
const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

type MockOperation = { kind: string };
type MockTransaction = { hash: string };
type MockSubmitResult = { id: string; status: string };
type MockFn = (...args: unknown[]) => unknown;

function makeBuilder(): SmartAccountInitializerBuilder<MockOperation, MockTransaction> & {
  addOperation: MockFn;
  build: MockFn;
} {
  const builder = {
    addOperation: jest.fn().mockReturnThis(),
    build: jest.fn().mockResolvedValue({ hash: 'tx-1' }),
  };

  return builder as SmartAccountInitializerBuilder<MockOperation, MockTransaction> & {
    addOperation: MockFn;
    build: MockFn;
  };
}

function makeContract(): SmartAccountInitializerContract<MockOperation> & {
  initialize: MockFn;
  buildInvokeOperation: MockFn;
} {
  const contract = {
    initialize: jest.fn().mockReturnValue({
      method: 'initialize',
      args: [],
    }),
    buildInvokeOperation: jest.fn().mockReturnValue({ kind: 'invoke-op' }),
  };

  return contract as SmartAccountInitializerContract<MockOperation> & {
    initialize: MockFn;
    buildInvokeOperation: MockFn;
  };
}

describe('initializeSmartAccount', () => {
  it('validates contractId input', async () => {
    await expect(
      initializeSmartAccount('', {
        ownerPublicKey: OWNER_PUBLIC_KEY,
        createTransactionBuilder: () => makeBuilder(),
      })
    ).rejects.toThrow(BuilderValidationError);

    await expect(
      initializeSmartAccount('not-a-contract-id', {
        ownerPublicKey: OWNER_PUBLIC_KEY,
        createTransactionBuilder: () => makeBuilder(),
      })
    ).rejects.toThrow(/Invalid contractId format/);
  });

  it('builds initialize operation and returns contract address by default', async () => {
    const builder = makeBuilder();
    const contract = makeContract();
    const createTransactionBuilder = jest.fn().mockReturnValue(builder);
    const createAccountContract = jest.fn().mockReturnValue(contract);

    const result = await initializeSmartAccount(CONTRACT_ID, {
      ownerPublicKey: OWNER_PUBLIC_KEY,
      createTransactionBuilder,
      createAccountContract,
    });

    expect(createAccountContract).toHaveBeenCalledWith(CONTRACT_ID);
    expect(contract.initialize).toHaveBeenCalledWith(OWNER_PUBLIC_KEY);
    expect(contract.buildInvokeOperation).toHaveBeenCalledTimes(1);
    expect(createTransactionBuilder).toHaveBeenCalledWith(CONTRACT_ID);
    expect(builder.addOperation).toHaveBeenCalledWith({ kind: 'invoke-op' });
    expect(builder.build).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: 'contractAddress',
      contractAddress: CONTRACT_ID,
    });
  });

  it('returns typed transaction result when submitTransaction is provided', async () => {
    const builder = makeBuilder();
    const contract = makeContract();
    const submitTransaction = jest
      .fn<Promise<MockSubmitResult>, [MockTransaction]>()
      .mockResolvedValue({
        id: 'tx-123',
        status: 'PENDING',
      });

    const result = await initializeSmartAccount<MockOperation, MockTransaction, MockSubmitResult>(
      CONTRACT_ID,
      {
        ownerPublicKey: OWNER_PUBLIC_KEY,
        createTransactionBuilder: () => builder,
        createAccountContract: () => contract,
        submitTransaction,
      }
    );

    expect(submitTransaction).toHaveBeenCalledWith({ hash: 'tx-1' });
    expect(result).toEqual({
      kind: 'transactionResult',
      txResult: {
        id: 'tx-123',
        status: 'PENDING',
      },
    });
  });
});

describe('AncoreClient.initializeSmartAccount', () => {
  it('delegates to initialize flow and returns typed result', async () => {
    const builder = makeBuilder();
    const contract = makeContract();

    const client = new AncoreClient<MockOperation, MockTransaction, MockSubmitResult>({
      ownerPublicKey: OWNER_PUBLIC_KEY,
      createTransactionBuilder: jest.fn().mockReturnValue(builder),
      createAccountContract: jest.fn().mockReturnValue(contract),
      submitTransaction: jest.fn().mockResolvedValue({
        id: 'tx-456',
        status: 'SUCCESS',
      }),
    });

    const result = await client.initializeSmartAccount(CONTRACT_ID);

    expect(result).toEqual({
      kind: 'transactionResult',
      txResult: {
        id: 'tx-456',
        status: 'SUCCESS',
      },
    });
  });
});
