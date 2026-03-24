/**
 * Unit tests for AccountContract and XDR helpers with mocked contract responses.
 */

import { Address, xdr } from '@stellar/stellar-sdk';
import {
  AccountContract,
  type AccountContractReadOptions,
  addressToScVal,
  AlreadyInitializedError,
  mapContractError,
  NotInitializedError,
  permissionsToScVal,
  publicKeyToBytes32ScVal,
  scValToAddress,
  scValToOptionalSessionKey,
  scValToSessionKey,
  scValToU64,
  symbolToScVal,
  u64ToScVal,
} from '../index';

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const OWNER_ADDRESS = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

describe('AccountContract', () => {
  let contract: AccountContract;

  beforeEach(() => {
    contract = new AccountContract(CONTRACT_ID);
  });

  describe('initialize', () => {
    it('returns method and single address arg', () => {
      const inv = contract.initialize(OWNER_ADDRESS);
      expect(inv.method).toBe('initialize');
      expect(inv.args).toHaveLength(1);
      expect(scValToAddress(inv.args[0])).toBe(OWNER_ADDRESS);
    });

    it('buildInvokeOperation produces an operation', () => {
      const inv = contract.initialize(OWNER_ADDRESS);
      const op = contract.buildInvokeOperation(inv);
      expect(op).toBeDefined();
      expect(typeof op).toBe('object');
    });
  });

  describe('execute', () => {
    it('returns method and to, function, args, expectedNonce', () => {
      const to = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
      const fn = 'transfer';
      const args: xdr.ScVal[] = [new Address(OWNER_ADDRESS).toScVal(), xdr.ScVal.scvU32(100)];
      const inv = contract.execute(to, fn, args, 0);
      expect(inv.method).toBe('execute');
      expect(inv.args).toHaveLength(4);
      expect(scValToAddress(inv.args[0])).toBe(to);
      expect(inv.args[1]).toBeDefined();
      expect(inv.args[2].vec()).toHaveLength(2);
      expect(scValToU64(inv.args[3])).toBe(0);
    });
  });

  describe('addSessionKey', () => {
    it('returns method and publicKey, expiresAt, permissions (contract order)', () => {
      const publicKey = OWNER_ADDRESS;
      const permissions = [0, 2];
      const expiresAt = 1700000000;
      const inv = contract.addSessionKey(publicKey, permissions, expiresAt);
      expect(inv.method).toBe('add_session_key');
      expect(inv.args).toHaveLength(3);
      expect(inv.args[0]).toBeDefined();
      expect(inv.args[1]).toBeDefined();
      expect(inv.args[2]).toBeDefined();
    });
  });

  describe('revokeSessionKey', () => {
    it('returns method and single publicKey arg', () => {
      const inv = contract.revokeSessionKey(OWNER_ADDRESS);
      expect(inv.method).toBe('revoke_session_key');
      expect(inv.args).toHaveLength(1);
    });
  });

  describe('getOwnerInvocation / getNonceInvocation', () => {
    it('getOwnerInvocation has no args', () => {
      const inv = contract.getOwnerInvocation();
      expect(inv.method).toBe('get_owner');
      expect(inv.args).toHaveLength(0);
    });

    it('getNonceInvocation has no args', () => {
      const inv = contract.getNonceInvocation();
      expect(inv.method).toBe('get_nonce');
      expect(inv.args).toHaveLength(0);
    });
  });

  describe('getSessionKey with mocked server', () => {
    it('getSessionKey returns null when simulation returns void', async () => {
      const mockSimSuccess = {
        result: { retval: xdr.ScVal.scvVoid() },
      };
      const server = {
        getAccount: jest.fn().mockResolvedValue({
          id: OWNER_ADDRESS,
          sequence: '1',
        }),
        simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
      } as AccountContractReadOptions['server'];

      const result = await contract.getSessionKey(OWNER_ADDRESS, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      expect(result).toBeNull();
      expect(server.simulateTransaction).toHaveBeenCalled();
    });
  });

  describe('getOwner with mocked server', () => {
    it('getOwner returns address from simulated result', async () => {
      const ownerScVal = new Address(OWNER_ADDRESS).toScVal();
      const mockSimSuccess = {
        result: { retval: ownerScVal },
      };
      const server = {
        getAccount: jest.fn().mockResolvedValue({
          id: OWNER_ADDRESS,
          sequence: '1',
        }),
        simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
      } as AccountContractReadOptions['server'];

      const result = await contract.getOwner({
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      expect(result).toBe(OWNER_ADDRESS);
    });
  });

  describe('getNonce with mocked server', () => {
    it('getNonce returns number from simulated u64 result', async () => {
      const nonceScVal = xdr.ScVal.scvU64(new xdr.Uint64(42n));
      const mockSimSuccess = {
        result: { retval: nonceScVal },
      };
      const server = {
        getAccount: jest.fn().mockResolvedValue({
          id: OWNER_ADDRESS,
          sequence: '1',
        }),
        simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
      } as AccountContractReadOptions['server'];

      const result = await contract.getNonce({
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      expect(result).toBe(42);
    });
  });

  describe('simulation error mapping', () => {
    it('getOwner throws NotInitializedError when simulation returns not initialized', async () => {
      const server = {
        getAccount: jest.fn().mockResolvedValue({
          id: OWNER_ADDRESS,
          sequence: '1',
        }),
        simulateTransaction: jest.fn().mockResolvedValue({
          error: 'Host function failure: Not initialized',
        }),
      } as AccountContractReadOptions['server'];

      await expect(
        contract.getOwner({
          server,
          sourceAccount: OWNER_ADDRESS,
          networkPassphrase: 'Test SDF Network ; September 2015',
        })
      ).rejects.toThrow(NotInitializedError);
    });
  });
});

describe('XDR encoding helpers', () => {
  describe('addressToScVal / scValToAddress', () => {
    it('round-trips owner address', () => {
      const scVal = addressToScVal(OWNER_ADDRESS);
      expect(scValToAddress(scVal)).toBe(OWNER_ADDRESS);
    });
  });

  describe('publicKeyToBytes32ScVal', () => {
    it('accepts G... string and produces 32-byte ScVal', () => {
      const scVal = publicKeyToBytes32ScVal(OWNER_ADDRESS);
      expect(scVal.switch().name).toBe('scvBytes');
      expect(scVal.bytes().length).toBe(32);
    });

    it('throws for invalid public key format', () => {
      expect(() => publicKeyToBytes32ScVal('invalid')).toThrow(TypeError);
    });

    it('throws for wrong byte length', () => {
      expect(() => publicKeyToBytes32ScVal(new Uint8Array(16))).toThrow(TypeError);
    });
  });

  describe('u64ToScVal / scValToU64', () => {
    it('encodes number and decodes to number', () => {
      const scVal = u64ToScVal(999);
      expect(scValToU64(scVal)).toBe(999);
    });

    it('encodes bigint', () => {
      const scVal = u64ToScVal(Number.MAX_SAFE_INTEGER + 1);
      expect(scVal).toBeDefined();
    });
  });

  describe('permissionsToScVal', () => {
    it('encodes array of u32', () => {
      const scVal = permissionsToScVal([0, 1, 2]);
      expect(scVal.vec()).toHaveLength(3);
    });
  });

  describe('symbolToScVal', () => {
    it('encodes function name as symbol', () => {
      const scVal = symbolToScVal('transfer');
      expect(scVal.switch().name).toBe('scvSymbol');
    });
  });

  describe('scValToSessionKey', () => {
    it('decodes map with public_key, expires_at, permissions to SessionKey', () => {
      const pkBytes = new Uint8Array(32);
      pkBytes[0] = 1;
      const scVal = xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol(Buffer.from('expires_at')),
          val: xdr.ScVal.scvU64(new xdr.Uint64(1700000000n)),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol(Buffer.from('permissions')),
          val: xdr.ScVal.scvVec([xdr.ScVal.scvU32(0), xdr.ScVal.scvU32(2)]),
        }),
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol(Buffer.from('public_key')),
          val: xdr.ScVal.scvBytes(Buffer.from(pkBytes)),
        }),
      ]);
      const sk = scValToSessionKey(scVal);
      expect(sk.expiresAt).toBe(1700000000);
      expect(sk.permissions).toEqual([0, 2]);
      expect(sk.publicKey).toBeDefined();
      expect(typeof sk.publicKey).toBe('string');
    });
  });

  describe('scValToOptionalSessionKey', () => {
    it('returns null for void', () => {
      expect(scValToOptionalSessionKey(xdr.ScVal.scvVoid())).toBeNull();
    });
  });
});

describe('Error mapping', () => {
  it('mapContractError maps Already initialized to AlreadyInitializedError', () => {
    const err = mapContractError('Host error: Already initialized');
    expect(err.name).toBe('AlreadyInitializedError');
    expect(err).toBeInstanceOf(AlreadyInitializedError);
  });

  it('mapContractError maps Not initialized to NotInitializedError', () => {
    const err = mapContractError('Not initialized');
    expect(err.name).toBe('NotInitializedError');
  });

  it('mapContractError returns ContractInvocationError for unknown message', () => {
    const err = mapContractError('Some other error');
    expect(err.name).toBe('ContractInvocationError');
  });
});
