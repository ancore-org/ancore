import { xdr } from '@stellar/stellar-sdk';

import { AccountContract } from '../account-contract';
import { addSessionKey } from '../add-session-key';
import { getSessionKey } from '../get-session-key';

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const OWNER_ADDRESS = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

const readOptions = {
  server: {
    getAccount: jest.fn(),
    simulateTransaction: jest.fn(),
  },
  sourceAccount: OWNER_ADDRESS,
  networkPassphrase: 'Test SDF Network ; September 2015',
};

describe('session key wrapper helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('addSessionKey returns invocation when called without read options', () => {
    const invocation = addSessionKey(CONTRACT_ID, OWNER_ADDRESS, [0, 2], 1_700_000_000);

    expect(invocation.method).toBe('add_session_key');
    expect(invocation.args).toHaveLength(3);
  });

  it('addSessionKey returns invocation + operation when options are provided', async () => {
    const contract = {
      addSessionKey: jest.fn().mockReturnValue({
        method: 'add_session_key',
        args: [xdr.ScVal.scvVoid(), xdr.ScVal.scvVoid(), xdr.ScVal.scvVoid()],
      }),
      buildInvokeOperation: jest.fn().mockReturnValue({ type: 'invoke-op' }),
    } as unknown as AccountContract;

    const result = await addSessionKey(contract, OWNER_ADDRESS, [1], 1_800_000_000, {
      ...readOptions,
    });

    expect(result.invocation.method).toBe('add_session_key');
    expect(result.operation).toEqual({ type: 'invoke-op' });
  });

  it('getSessionKey delegates to a provided AccountContract instance', async () => {
    const expected = { publicKey: OWNER_ADDRESS, permissions: [0], expiresAt: 1_900_000_000 };
    const contract = {
      getSessionKey: jest.fn().mockResolvedValue(expected),
    } as unknown as AccountContract;

    const result = await getSessionKey(contract, OWNER_ADDRESS, {
      ...readOptions,
    });

    expect(result).toEqual(expected);
    expect(contract.getSessionKey).toHaveBeenCalledWith(
      OWNER_ADDRESS,
      expect.objectContaining({ sourceAccount: OWNER_ADDRESS })
    );
  });

  it('getSessionKey supports string contract id and uses AccountContract implementation', async () => {
    const spy = jest.spyOn(AccountContract.prototype, 'getSessionKey').mockResolvedValue(null);

    const result = await getSessionKey(CONTRACT_ID, OWNER_ADDRESS, {
      ...readOptions,
    });

    expect(result).toBeNull();
    expect(spy).toHaveBeenCalled();
  });
});
