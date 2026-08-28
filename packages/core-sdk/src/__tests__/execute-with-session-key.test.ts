import { xdr } from '@stellar/stellar-sdk';
import {
  AccountContractError,
  InvalidNonceError,
  NotInitializedError,
  UnauthorizedError,
} from '@ancore/account-abstraction';

import { AncoreClient, mapExecuteWithSessionKeyError } from '../execute-with-session-key';
import { SessionKeyExecutionError, SessionKeyExecutionValidationError } from '../errors';

const VALID_CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const VALID_PUBLIC_KEY = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

describe('execute-with-session-key', () => {
  it('forwards validated request to execution layer', async () => {
    const invocation = { method: 'execute', args: [] };
    const accountContract = {
      execute: jest.fn().mockReturnValue(invocation),
    } as any;
    const executionLayer = {
      executeWithSessionKey: jest.fn().mockResolvedValue({ result: xdr.ScVal.scvVoid() }),
    };
    const client = new AncoreClient({
      accountContract,
      executionLayer,
    });

    const result = await client.executeWithSessionKey({
      target: VALID_CONTRACT,
      function: 'transfer',
      args: [xdr.ScVal.scvU32(7)],
      expectedNonce: 2,
      signer: {
        publicKey: VALID_PUBLIC_KEY,
        signAuthEntryXdr: jest.fn().mockResolvedValue('sig'),
      },
    });

    expect(result).toEqual({ result: xdr.ScVal.scvVoid() });
    expect(accountContract.execute).toHaveBeenCalledWith(
      VALID_CONTRACT,
      'transfer',
      [xdr.ScVal.scvU32(7)],
      2,
      VALID_PUBLIC_KEY,
      undefined
    );
    expect(executionLayer.executeWithSessionKey).toHaveBeenCalledWith(
      expect.objectContaining({
        target: VALID_CONTRACT,
        function: 'transfer',
        expectedNonce: 2,
        invocation,
      })
    );
  });

  it('validates target address', async () => {
    const client = new AncoreClient({
      accountContract: { execute: jest.fn() } as any,
      executionLayer: { executeWithSessionKey: jest.fn() },
    });

    await expect(
      client.executeWithSessionKey({
        target: 'not-a-stellar-address',
        function: 'transfer',
        args: [],
        expectedNonce: 0,
        signer: {
          publicKey: VALID_PUBLIC_KEY,
          signAuthEntryXdr: jest.fn(),
        },
      })
    ).rejects.toBeInstanceOf(SessionKeyExecutionValidationError);
  });

  it('rejects a missing signer', async () => {
    const client = new AncoreClient({
      accountContract: { execute: jest.fn() } as any,
      executionLayer: { executeWithSessionKey: jest.fn() },
    });

    for (const signer of [undefined, null]) {
      await expect(
        client.executeWithSessionKey({
          target: VALID_CONTRACT,
          function: 'transfer',
          args: [],
          expectedNonce: 0,
          signer: signer as any,
        })
      ).rejects.toThrow(/signer\.publicKey must be a valid Stellar Ed25519 public key/);
    }
  });

  it('validates function name, args, nonce, and signer fields', async () => {
    const client = new AncoreClient({
      accountContract: { execute: jest.fn() } as any,
      executionLayer: { executeWithSessionKey: jest.fn() },
    });

    await expect(
      client.executeWithSessionKey({
        target: VALID_CONTRACT,
        function: '   ',
        args: [],
        expectedNonce: 0,
        signer: { publicKey: VALID_PUBLIC_KEY, signAuthEntryXdr: jest.fn() },
      })
    ).rejects.toBeInstanceOf(SessionKeyExecutionValidationError);

    await expect(
      client.executeWithSessionKey({
        target: VALID_CONTRACT,
        function: 'transfer',
        args: 'nope' as unknown as xdr.ScVal[],
        expectedNonce: 0,
        signer: { publicKey: VALID_PUBLIC_KEY, signAuthEntryXdr: jest.fn() },
      })
    ).rejects.toBeInstanceOf(SessionKeyExecutionValidationError);

    await expect(
      client.executeWithSessionKey({
        target: VALID_CONTRACT,
        function: 'transfer',
        args: [],
        expectedNonce: -1,
        signer: { publicKey: VALID_PUBLIC_KEY, signAuthEntryXdr: jest.fn() },
      })
    ).rejects.toBeInstanceOf(SessionKeyExecutionValidationError);

    await expect(
      client.executeWithSessionKey({
        target: VALID_CONTRACT,
        function: 'transfer',
        args: [],
        expectedNonce: 0,
        signer: { publicKey: 'BAD', signAuthEntryXdr: jest.fn() },
      })
    ).rejects.toBeInstanceOf(SessionKeyExecutionValidationError);

    await expect(
      client.executeWithSessionKey({
        target: VALID_CONTRACT,
        function: 'transfer',
        args: [],
        expectedNonce: 0,
        signer: { publicKey: VALID_PUBLIC_KEY, signAuthEntryXdr: 'nope' as unknown as any },
      })
    ).rejects.toBeInstanceOf(SessionKeyExecutionValidationError);
  });

  it('maps account-abstraction and generic errors to session-key errors', async () => {
    const accountContract = {
      execute: jest.fn().mockImplementationOnce(() => {
        throw new UnauthorizedError('unauthorized');
      }),
    } as any;
    const client = new AncoreClient({
      accountContract,
      executionLayer: { executeWithSessionKey: jest.fn() },
    });

    await expect(
      client.executeWithSessionKey({
        target: VALID_CONTRACT,
        function: 'transfer',
        args: [],
        expectedNonce: 0,
        signer: { publicKey: VALID_PUBLIC_KEY, signAuthEntryXdr: jest.fn() },
      })
    ).rejects.toMatchObject({
      code: 'SESSION_KEY_EXECUTION_UNAUTHORIZED',
    });
  });
});

describe('mapExecuteWithSessionKeyError', () => {
  it('passes through AncoreSdkError', () => {
    const err = new SessionKeyExecutionError('SESSION_KEY_EXECUTION_FAILED', 'failed');
    expect(mapExecuteWithSessionKeyError(err)).toBe(err);
  });

  it('maps known contract errors', () => {
    expect(mapExecuteWithSessionKeyError(new UnauthorizedError()).code).toBe(
      'SESSION_KEY_EXECUTION_UNAUTHORIZED'
    );
    expect(mapExecuteWithSessionKeyError(new InvalidNonceError()).code).toBe(
      'SESSION_KEY_EXECUTION_INVALID_NONCE'
    );
    expect(mapExecuteWithSessionKeyError(new NotInitializedError()).code).toBe(
      'SESSION_KEY_EXECUTION_NOT_INITIALIZED'
    );
    expect(mapExecuteWithSessionKeyError(new AccountContractError('contract'))).toMatchObject({
      code: 'SESSION_KEY_EXECUTION_CONTRACT',
    });
  });

  it('maps generic and unknown errors', () => {
    expect(mapExecuteWithSessionKeyError(new Error('boom')).code).toBe(
      'SESSION_KEY_EXECUTION_FAILED'
    );
    expect(mapExecuteWithSessionKeyError('boom').code).toBe('SESSION_KEY_EXECUTION_FAILED');
  });
});
