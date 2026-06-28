/**
 * Unit tests for getOwner, getNonce, and getVersion functions with mocked contract responses.
 */

import { Address, xdr } from '@stellar/stellar-sdk';
import {
  getOwner,
  getNonce,
  getVersion,
  type AccountContractReadOptions,
  NotInitializedError,
  InvalidNonceError,
  ContractInvocationError,
} from '../index';

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const OWNER_ADDRESS = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

describe('getOwner', () => {
  it('returns correctly typed owner address from mocked contract response', async () => {
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

    const result = await getOwner(CONTRACT_ID, {
      server,
      sourceAccount: OWNER_ADDRESS,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(result).toBe(OWNER_ADDRESS);
    expect(typeof result).toBe('string');
  });

  it('throws TypeError when contract returns unexpected type (parse error)', async () => {
    // Return a u64 instead of an address to simulate unexpected type
    const unexpectedScVal = xdr.ScVal.scvU64(new xdr.Uint64(42n));
    const mockSimSuccess = {
      result: { retval: unexpectedScVal },
    };
    const server = {
      getAccount: jest.fn().mockResolvedValue({
        id: OWNER_ADDRESS,
        sequence: '1',
      }),
      simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
    } as AccountContractReadOptions['server'];

    await expect(
      getOwner(CONTRACT_ID, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
    ).rejects.toThrow(TypeError);
  });

  it('throws NotInitializedError when contract call fails with not initialized error', async () => {
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
      getOwner(CONTRACT_ID, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
    ).rejects.toThrow(NotInitializedError);
  });

  it('throws ContractInvocationError when contract call fails', async () => {
    const server = {
      getAccount: jest.fn().mockResolvedValue({
        id: OWNER_ADDRESS,
        sequence: '1',
      }),
      simulateTransaction: jest.fn().mockResolvedValue({
        error: 'Network error',
      }),
    } as AccountContractReadOptions['server'];

    await expect(
      getOwner(CONTRACT_ID, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
    ).rejects.toThrow(ContractInvocationError);
  });
});

describe('getNonce', () => {
  it('returns correctly typed nonce (number) from mocked contract response', async () => {
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

    const result = await getNonce(CONTRACT_ID, {
      server,
      sourceAccount: OWNER_ADDRESS,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(result).toBe(42);
    expect(typeof result).toBe('number');
  });

  it('throws TypeError when contract returns unexpected type (parse error)', async () => {
    // Return an address instead of u64 to simulate unexpected type
    const unexpectedScVal = new Address(OWNER_ADDRESS).toScVal();
    const mockSimSuccess = {
      result: { retval: unexpectedScVal },
    };
    const server = {
      getAccount: jest.fn().mockResolvedValue({
        id: OWNER_ADDRESS,
        sequence: '1',
      }),
      simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
    } as AccountContractReadOptions['server'];

    await expect(
      getNonce(CONTRACT_ID, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
    ).rejects.toThrow(TypeError);
  });

  it('throws InvalidNonceError when contract call fails', async () => {
    const server = {
      getAccount: jest.fn().mockResolvedValue({
        id: OWNER_ADDRESS,
        sequence: '1',
      }),
      simulateTransaction: jest.fn().mockResolvedValue({
        error: 'Host function failure: Invalid nonce',
      }),
    } as AccountContractReadOptions['server'];

    await expect(
      getNonce(CONTRACT_ID, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
    ).rejects.toThrow(InvalidNonceError);
  });

  it('returns large nonce values correctly', async () => {
    const largeNonce = 9007199254740991; // Number.MAX_SAFE_INTEGER
    const nonceScVal = xdr.ScVal.scvU64(new xdr.Uint64(BigInt(largeNonce)));
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

    const result = await getNonce(CONTRACT_ID, {
      server,
      sourceAccount: OWNER_ADDRESS,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(result).toBe(largeNonce);
  });
});

describe('getVersion', () => {
  it('returns version as number from mocked u32 response', async () => {
    const versionScVal = xdr.ScVal.scvU32(1);
    const mockSimSuccess = { result: { retval: versionScVal } };
    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: OWNER_ADDRESS, sequence: '1' }),
      simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
    } as AccountContractReadOptions['server'];

    const result = await getVersion(CONTRACT_ID, {
      server,
      sourceAccount: OWNER_ADDRESS,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(result).toBe(1);
    expect(typeof result).toBe('number');
  });

  it('returns 0 when version key is absent (pre-initialize)', async () => {
    const versionScVal = xdr.ScVal.scvU32(0);
    const mockSimSuccess = { result: { retval: versionScVal } };
    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: OWNER_ADDRESS, sequence: '1' }),
      simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
    } as AccountContractReadOptions['server'];

    const result = await getVersion(CONTRACT_ID, {
      server,
      sourceAccount: OWNER_ADDRESS,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(result).toBe(0);
  });

  it('returns incremented version after upgrade', async () => {
    const versionScVal = xdr.ScVal.scvU32(2);
    const mockSimSuccess = { result: { retval: versionScVal } };
    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: OWNER_ADDRESS, sequence: '1' }),
      simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
    } as AccountContractReadOptions['server'];

    const result = await getVersion(CONTRACT_ID, {
      server,
      sourceAccount: OWNER_ADDRESS,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(result).toBe(2);
  });

  it('throws TypeError when contract returns unexpected type', async () => {
    const unexpectedScVal = new Address(OWNER_ADDRESS).toScVal();
    const mockSimSuccess = { result: { retval: unexpectedScVal } };
    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: OWNER_ADDRESS, sequence: '1' }),
      simulateTransaction: jest.fn().mockResolvedValue(mockSimSuccess),
    } as AccountContractReadOptions['server'];

    await expect(
      getVersion(CONTRACT_ID, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
    ).rejects.toThrow(TypeError);
  });

  it('throws ContractInvocationError when simulation fails', async () => {
    const server = {
      getAccount: jest.fn().mockResolvedValue({ id: OWNER_ADDRESS, sequence: '1' }),
      simulateTransaction: jest.fn().mockResolvedValue({ error: 'Host function failure' }),
    } as AccountContractReadOptions['server'];

    await expect(
      getVersion(CONTRACT_ID, {
        server,
        sourceAccount: OWNER_ADDRESS,
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
    ).rejects.toThrow(ContractInvocationError);
  });
});
