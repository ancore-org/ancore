import {
  AccountContract,
  AccountContractError,
  InvalidNonceError,
  NotInitializedError,
  UnauthorizedError,
} from '@ancore/account-abstraction';
import { Keypair, StrKey, xdr } from '@stellar/stellar-sdk';

import {
  AncoreClient,
  mapExecuteWithSessionKeyError,
  type ExecuteWithSessionKeyParams,
  type SessionKeyExecutionLayer,
} from '../execute-with-session-key';
import { SessionKeyExecutionError, SessionKeyExecutionValidationError } from '../errors';

const ACCOUNT_CONTRACT_ID = StrKey.encodeContract(require('crypto').randomBytes(32));
const TARGET_CONTRACT_ID = StrKey.encodeContract(require('crypto').randomBytes(32));
const SESSION_PUBLIC_KEY = Keypair.random().publicKey();

function makeArgs(): xdr.ScVal[] {
  return [xdr.ScVal.scvU32(7), xdr.ScVal.scvString('memo')];
}

function makeSigner() {
  return {
    publicKey: SESSION_PUBLIC_KEY,
    signAuthEntryXdr: jest.fn().mockResolvedValue('signed-auth-entry-xdr'),
  };
}

function makeParams(
  overrides: Partial<ExecuteWithSessionKeyParams<xdr.ScVal[]>> = {}
): ExecuteWithSessionKeyParams<xdr.ScVal[]> {
  return {
    target: TARGET_CONTRACT_ID,
    function: 'transfer',
    args: makeArgs(),
    expectedNonce: 12,
    signer: makeSigner(),
    ...overrides,
  };
}

function makeExecutionLayer<TResult>(
  implementation?: (_request: unknown) => Promise<{ result: TResult; transactionHash?: string }>
): SessionKeyExecutionLayer & {
  executeWithSessionKey: jest.Mock;
} {
  const executeWithSessionKey = jest.fn(
    implementation ??
      (async (_request: unknown) => ({
        result: { ok: true } as TResult,
        transactionHash: 'tx-hash',
      }))
  ) as unknown as SessionKeyExecutionLayer['executeWithSessionKey'] & jest.Mock;

  return {
    executeWithSessionKey,
  };
}

describe('AncoreClient.executeWithSessionKey', () => {
  it('delegates contract execution to the execution layer with a typed invocation', async () => {
    const executionLayer = makeExecutionLayer<{ ok: boolean }>();
    const accountContract = new AccountContract(ACCOUNT_CONTRACT_ID);
    const client = new AncoreClient({ accountContract, executionLayer });
    const params = makeParams();

    const result = await client.executeWithSessionKey<{ ok: boolean }>(params);
    const request = executionLayer.executeWithSessionKey.mock.calls[0]?.[0];
    const expectedInvocation = accountContract.execute(
      params.target,
      params.function,
      params.args,
      params.expectedNonce
    );

    expect(result).toEqual({ result: { ok: true }, transactionHash: 'tx-hash' });
    expect(executionLayer.executeWithSessionKey).toHaveBeenCalledTimes(1);
    expect(request).toMatchObject({
      target: params.target,
      function: params.function,
      args: params.args,
      expectedNonce: params.expectedNonce,
      signer: params.signer,
      invocation: {
        method: expectedInvocation.method,
      },
    });
    expect(request?.invocation.args.map((arg: xdr.ScVal) => arg.toXDR('base64'))).toEqual(
      expectedInvocation.args.map((arg: xdr.ScVal) => arg.toXDR('base64'))
    );
  });

  it('returns typed results from the execution layer unchanged', async () => {
    const executionLayer = makeExecutionLayer<{ receiptId: string; success: true }>(async () => ({
      result: { receiptId: 'receipt-1', success: true },
      transactionHash: 'hash-1',
    }));
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    const result = await client.executeWithSessionKey<{ receiptId: string; success: true }>(
      makeParams()
    );

    expect(result.result.receiptId).toBe('receipt-1');
    expect(result.result.success).toBe(true);
    expect(result.transactionHash).toBe('hash-1');
  });

    });
    expect(request?.invocation.args.map((arg: xdr.ScVal) => arg.toXDR('base64'))).toEqual(
      expectedInvocation.args.map((arg: xdr.ScVal) => arg.toXDR('base64'))
    );
  });

  it('returns typed results from the execution layer unchanged', async () => {
    const executionLayer = makeExecutionLayer<{ receiptId: string; success: true }>(async () => ({
      result: { receiptId: 'receipt-1', success: true },
      transactionHash: 'hash-1',
    }));
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    const result = await client.executeWithSessionKey<{ receiptId: string; success: true }>(
      makeParams()
    );

    expect(result.result.receiptId).toBe('receipt-1');
    expect(result.result.success).toBe(true);
    expect(result.transactionHash).toBe('hash-1');
  });

  it('rejects invalid signer inputs before delegation', async () => {
    const executionLayer = makeExecutionLayer<{ ok: boolean }>();
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(
      client.executeWithSessionKey({
        ...makeParams(),
        signer: {
          publicKey: 'BADKEY',
          signAuthEntryXdr: jest.fn(),
        },
      })
    ).rejects.toThrow(SessionKeyExecutionValidationError);
    expect(executionLayer.executeWithSessionKey).not.toHaveBeenCalled();
  });

  it('maps unauthorized failures deterministically', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new UnauthorizedError('session key cannot call this target');
    });
  it('rejects invalid target addresses before delegation', async () => {
    const executionLayer = makeExecutionLayer<{ ok: boolean }>();
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(client.executeWithSessionKey(makeParams())).rejects.toMatchObject({
      name: 'SessionKeyExecutionError',
      code: 'SESSION_KEY_EXECUTION_UNAUTHORIZED',
      message: 'session key cannot call this target',
    });
  });

  it('maps invalid nonce failures deterministically', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new InvalidNonceError('nonce mismatch');
    });
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(client.executeWithSessionKey(makeParams())).rejects.toMatchObject({
      code: 'SESSION_KEY_EXECUTION_INVALID_NONCE',
      message: 'nonce mismatch',
    });
  });

  it('maps not-initialized failures deterministically', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new NotInitializedError();
    await expect(
      client.executeWithSessionKey({
        ...makeParams(),
        target: 'not-a-contract-id',
      })
    ).rejects.toThrow('target must be a valid Stellar address in G... or C... format.');
  });

  it('rejects empty function names', async () => {
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer: makeExecutionLayer<{ ok: boolean }>(),
    });

    await expect(
      client.executeWithSessionKey({
        ...makeParams(),
        function: '   ',
      })
    ).rejects.toThrow('function is required.');
  });

  it('rejects non-array args', async () => {
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer: makeExecutionLayer<{ ok: boolean }>(),
    });

    await expect(
      client.executeWithSessionKey({
        ...makeParams(),
        args: 'bad-args' as never,
      })
    ).rejects.toThrow('args must be an array of ScVal values.');
  });

  it('rejects negative expected nonces', async () => {
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer: makeExecutionLayer<{ ok: boolean }>(),
    });

    await expect(
      client.executeWithSessionKey({
        ...makeParams(),
        expectedNonce: -1,
      })
    ).rejects.toThrow('expectedNonce must be a non-negative integer.');
  });

  it('rejects missing signer callbacks', async () => {
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer: makeExecutionLayer<{ ok: boolean }>(),
    });

    await expect(
      client.executeWithSessionKey({
        ...makeParams(),
        signer: {
          publicKey: SESSION_PUBLIC_KEY,
          signAuthEntryXdr: 'not-a-function' as never,
        },
      })
    ).rejects.toThrow('signer.signAuthEntryXdr must be a function.');
  });

  it('maps unauthorized failures deterministically', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new UnauthorizedError('session key cannot call this target');
    });
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(client.executeWithSessionKey(makeParams())).rejects.toMatchObject({
      code: 'SESSION_KEY_EXECUTION_NOT_INITIALIZED',
      message: 'Account contract is not initialized',
    });
  });

      name: 'SessionKeyExecutionError',
      code: 'SESSION_KEY_EXECUTION_UNAUTHORIZED',
      message: 'session key cannot call this target',
    });
  });

  it('maps invalid nonce failures deterministically', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new InvalidNonceError('nonce mismatch');
    });
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(client.executeWithSessionKey(makeParams())).rejects.toMatchObject({
      code: 'SESSION_KEY_EXECUTION_INVALID_NONCE',
      message: 'nonce mismatch',
    });
  });

  it('maps not-initialized failures deterministically', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new NotInitializedError();
    });
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(client.executeWithSessionKey(makeParams())).rejects.toMatchObject({
      code: 'SESSION_KEY_EXECUTION_NOT_INITIALIZED',
      message: 'Account contract is not initialized',
    });
  });

  it('maps generic account-contract failures deterministically', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new AccountContractError('contract execution reverted', 'ACCOUNT_CONTRACT_ERROR');
    });
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(client.executeWithSessionKey(makeParams())).rejects.toMatchObject({
      code: 'SESSION_KEY_EXECUTION_CONTRACT',
      message: 'contract execution reverted',
    });
  });

  it('maps unknown failures to a stable fallback error', async () => {
    const executionLayer = makeExecutionLayer<never>(async () => {
      throw new Error('unexpected transport failure');
    });
    const client = new AncoreClient({
      accountContract: new AccountContract(ACCOUNT_CONTRACT_ID),
      executionLayer,
    });

    await expect(client.executeWithSessionKey(makeParams())).rejects.toMatchObject({
      code: 'SESSION_KEY_EXECUTION_FAILED',
      message: 'unexpected transport failure',
    });
  });
});

describe('mapExecuteWithSessionKeyError', () => {
  it('returns existing core-sdk errors unchanged', () => {
    const error = new SessionKeyExecutionValidationError('invalid request');

    expect(mapExecuteWithSessionKeyError(error)).toBe(error);
  });

  it('maps non-Error values to the unknown fallback', () => {
    const mapped = mapExecuteWithSessionKeyError('boom');

    expect(mapped).toBeInstanceOf(SessionKeyExecutionError);
    expect(mapped.code).toBe('SESSION_KEY_EXECUTION_FAILED');
    expect(mapped.message).toBe('Session key execution failed with an unknown error.');
  });
});
