import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveKeypairFromMnemonic } from '@ancore/crypto';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Mock the AA layer: AccountContract.getOwner resolves only when the contract
// is "deployed" (controlled per-test via getOwnerImpl). initialize()/
// buildInvokeOperation() just need to produce something addOperation accepts.
let getOwnerImpl: () => Promise<string> = () => Promise.reject(new Error('not found'));

vi.mock('@ancore/account-abstraction', () => ({
  AccountContract: vi.fn().mockImplementation(() => ({
    getOwner: () => getOwnerImpl(),
    initialize: (owner: string) => ({ method: 'initialize', args: [owner] }),
    buildInvokeOperation: () => ({ type: 'invokeHostFunction' }),
  })),
}));

// Mock StellarClient: friendbot + account reads.
const fundWithFriendbot = vi.fn().mockResolvedValue(true);
vi.mock('@ancore/stellar', () => ({
  StellarClient: vi.fn().mockImplementation(() => ({
    fundWithFriendbot,
    getAccount: vi.fn().mockResolvedValue({ id: 'G', sequence: '0' }),
    getNetworkPassphrase: vi.fn().mockReturnValue('Test SDF Network ; September 2015'),
  })),
}));

// deriveContractId is deterministic — use the real implementation.
vi.mock('@ancore/core-sdk', async () => {
  const actual = await vi.importActual<typeof import('@ancore/core-sdk')>('@ancore/core-sdk');
  return {
    deriveContractId: actual.deriveContractId,
    ACCOUNT_CONTRACT_SALT: actual.ACCOUNT_CONTRACT_SALT,
  };
});

// Fake Soroban RPC server. `wasmInstalled`/`getAccountSequence` are toggled
// per test; every write step (upload/create/initialize) round-trips through
// the same prepareTransaction -> sign -> sendTransaction sequence, then polls
// confirmation via the mocked `fetch` below (deployAccount uses raw JSON-RPC
// for that, not server.pollTransaction).
let wasmInstalled = false;
const fakeAccount = {
  accountId: () => 'GOWNER',
  sequenceNumber: () => '1',
  incrementSequenceNumber: () => {},
};

const rpcServerInstance = {
  getAccount: vi.fn().mockResolvedValue(fakeAccount),
  getContractWasmByHash: vi.fn(() =>
    wasmInstalled ? Promise.resolve(Buffer.from('wasm')) : Promise.reject(new Error('not found'))
  ),
  simulateTransaction: vi.fn().mockResolvedValue({}),
  prepareTransaction: vi.fn((tx: unknown) => Promise.resolve(tx)),
  sendTransaction: vi.fn().mockResolvedValue({ status: 'PENDING', hash: 'tx-hash' }),
};

vi.mock('@stellar/stellar-sdk', async () => {
  const actual =
    await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  return {
    ...actual,
    TransactionBuilder: vi.fn().mockImplementation(() => {
      const builder = {
        addOperation: () => builder,
        setTimeout: () => builder,
        build: () => ({ sign: vi.fn() }),
      };
      return builder;
    }),
    rpc: {
      ...actual.rpc,
      Server: vi.fn().mockImplementation(() => rpcServerInstance),
    },
  };
});

import { createDeployClient } from '../deploy-account';
import { deriveContractId } from '@ancore/core-sdk';

describe('deploy-account service', () => {
  const owner = deriveKeypairFromMnemonic(MNEMONIC, 0);
  const ownerPublicKey = owner.publicKey();
  const expectedContractId = deriveContractId(ownerPublicKey, 'testnet');

  beforeEach(() => {
    // Two kinds of fetch calls: GET for the bundled WASM asset, POST for
    // deployAccount's own getTransaction JSON-RPC status polling (it avoids
    // server.pollTransaction — see the comment on pollTransactionStatus in
    // deploy-account.ts for why).
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ result: { status: 'SUCCESS' } }),
          });
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
        });
      })
    );
  });

  afterEach(() => {
    fundWithFriendbot.mockClear();
    rpcServerInstance.getAccount.mockClear();
    rpcServerInstance.getContractWasmByHash.mockClear();
    rpcServerInstance.prepareTransaction.mockClear();
    rpcServerInstance.sendTransaction.mockClear();
    getOwnerImpl = () => Promise.reject(new Error('not found'));
    wasmInstalled = false;
    vi.unstubAllGlobals();
  });

  it('deploys a new account: funds via friendbot, uploads WASM, creates and initializes the contract', async () => {
    getOwnerImpl = () => Promise.reject(new Error('not found'));
    wasmInstalled = false;
    const client = createDeployClient({ network: 'testnet' });

    const result = await client.deployAccount({ ownerPublicKey, signer: owner });

    expect(result.contractId).toBe(expectedContractId);
    expect(result.txHash).toBe('tx-hash');
    expect(fundWithFriendbot).toHaveBeenCalledWith(ownerPublicKey);
    // upload + create + initialize = 3 submitted transactions
    expect(rpcServerInstance.sendTransaction).toHaveBeenCalledTimes(3);
  });

  it('skips uploading the WASM when it is already installed', async () => {
    getOwnerImpl = () => Promise.reject(new Error('not found'));
    wasmInstalled = true;
    const client = createDeployClient({ network: 'testnet' });

    await client.deployAccount({ ownerPublicKey, signer: owner });

    // create + initialize only = 2 submitted transactions
    expect(rpcServerInstance.sendTransaction).toHaveBeenCalledTimes(2);
  });

  it('recovers an existing contract id without funding (reimport)', async () => {
    getOwnerImpl = () => Promise.resolve(ownerPublicKey);
    const client = createDeployClient({ network: 'testnet' });

    const result = await client.deployAccount({ ownerPublicKey, signer: owner });

    expect(result.contractId).toBe(expectedContractId);
    // No txHash on the reimport path.
    expect(result.txHash).toBeUndefined();
    expect(fundWithFriendbot).not.toHaveBeenCalled();
    expect(rpcServerInstance.sendTransaction).not.toHaveBeenCalled();
  });

  it('getDeployedContractId returns null when the contract does not exist', async () => {
    getOwnerImpl = () => Promise.reject(new Error('not found'));
    const client = createDeployClient({ network: 'testnet' });

    await expect(client.getDeployedContractId(ownerPublicKey)).resolves.toBeNull();
  });

  it('getDeployedContractId returns the contract id when it exists', async () => {
    getOwnerImpl = () => Promise.resolve(ownerPublicKey);
    const client = createDeployClient({ network: 'testnet' });

    await expect(client.getDeployedContractId(ownerPublicKey)).resolves.toBe(expectedContractId);
  });

  it('surfaces a clear error when the bundled WASM asset is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    getOwnerImpl = () => Promise.reject(new Error('not found'));
    const client = createDeployClient({ network: 'testnet' });

    await expect(client.deployAccount({ ownerPublicKey, signer: owner })).rejects.toThrow(
      /sync:wasm/
    );
  });
});
