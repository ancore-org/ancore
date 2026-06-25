import { afterEach, describe, expect, it, vi } from 'vitest';

import { deriveKeypairFromMnemonic } from '@ancore/crypto';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Mock the AA layer: AccountContract.getOwner resolves only when the contract
// is "deployed" (controlled per-test via getOwnerImpl).
let getOwnerImpl: () => Promise<string> = () => Promise.reject(new Error('not found'));

vi.mock('@ancore/account-abstraction', () => ({
  AccountContract: vi.fn().mockImplementation(() => ({
    getOwner: () => getOwnerImpl(),
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
  return { deriveContractId: actual.deriveContractId };
});

import { createDeployClient } from '../deploy-account';
import { deriveContractId } from '@ancore/core-sdk';

describe('deploy-account service', () => {
  const owner = deriveKeypairFromMnemonic(MNEMONIC, 0);
  const ownerPublicKey = owner.publicKey();
  const expectedContractId = deriveContractId(ownerPublicKey);

  afterEach(() => {
    fundWithFriendbot.mockClear();
    getOwnerImpl = () => Promise.reject(new Error('not found'));
  });

  it('deploys a new account: funds via friendbot and returns the derived contract id', async () => {
    getOwnerImpl = () => Promise.reject(new Error('not found'));
    const client = createDeployClient({ network: 'testnet' });

    const result = await client.deployAccount({ ownerPublicKey, signer: owner });

    expect(result.contractId).toBe(expectedContractId);
    expect(fundWithFriendbot).toHaveBeenCalledWith(ownerPublicKey);
  });

  it('recovers an existing contract id without funding (reimport)', async () => {
    getOwnerImpl = () => Promise.resolve(ownerPublicKey);
    const client = createDeployClient({ network: 'testnet' });

    const result = await client.deployAccount({ ownerPublicKey, signer: owner });

    expect(result.contractId).toBe(expectedContractId);
    // No txHash on the reimport path.
    expect(result.txHash).toBeUndefined();
    expect(fundWithFriendbot).not.toHaveBeenCalled();
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
});
