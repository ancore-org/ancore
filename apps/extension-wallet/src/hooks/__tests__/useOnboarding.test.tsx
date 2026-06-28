import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { deriveKeypairFromMnemonic } from '@ancore/crypto';

import { deriveOnboardingKeypair, useOnboarding } from '../useOnboarding';
import type { DeployClient } from '@/services/deploy-account';
import { useAccountStore } from '@/stores/account';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const MOCK_CONTRACT_ID = 'CTEST00000000000000000000000000000000000000000000MOCK';
const MOCK_TX_HASH = 'aaabbbcccdddeeefff111222333444555666777888999000aaa';

/**
 * Build a fresh hook instance pre-seeded with mnemonic + password and a mocked
 * deploy client. Returns the rendered hook and the mock so tests can assert on
 * the deploy call.
 */
async function setupOnboarding(deployClient: DeployClient) {
  const { result } = renderHook(() => useOnboarding({ deployClient }));

  act(() => {
    result.current.setMnemonicForImport(MNEMONIC);
    result.current.setPassword('SecurePass123!');
  });

  return { result };
}

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    useAccountStore.setState({ accounts: [], activeAccountId: null });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("derives the same keypair as the crypto primitive (BIP44 m/44'/148'/0')", () => {
    const expected = deriveKeypairFromMnemonic(MNEMONIC, 0);
    const actual = deriveOnboardingKeypair(MNEMONIC);

    expect(actual.publicKey()).toBe(expected.publicKey());
    expect(actual.secret()).toBe(expected.secret());
  });

  it('deploys and makes smartAccountId available in the account store', async () => {
    const deployAccount = vi
      .fn()
      .mockResolvedValue({ contractId: MOCK_CONTRACT_ID, txHash: MOCK_TX_HASH });
    const deployClient: DeployClient = {
      deployAccount,
      getDeployedContractId: vi.fn().mockResolvedValue(null),
    };

    const { result } = await setupOnboarding(deployClient);

    await act(async () => {
      await result.current.deployAccount('testnet');
    });

    const expectedKeypair = deriveKeypairFromMnemonic(MNEMONIC, 0);

    // Deploy client invoked with the BIP44 owner public key + a signer keypair.
    expect(deployAccount).toHaveBeenCalledTimes(1);
    const call = deployAccount.mock.calls[0][0];
    expect(call.ownerPublicKey).toBe(expectedKeypair.publicKey());
    expect(call.signer.publicKey()).toBe(expectedKeypair.publicKey());

    // Onboarding state carries the deployed contract + tx hash.
    expect(result.current.step).toBe('success');
    expect(result.current.account?.contractId).toBe(MOCK_CONTRACT_ID);
    expect(result.current.account?.txHash).toBe(MOCK_TX_HASH);
    expect(result.current.account?.alreadyDeployed).toBe(false);
    expect(result.current.account?.encryptedMnemonic.ciphertext).toBeTruthy();

    // smartAccountId (C-address) is persisted in the account store.
    const stored = useAccountStore
      .getState()
      .accounts.find((a) => a.id === expectedKeypair.publicKey());
    expect(stored?.contractId).toBe(MOCK_CONTRACT_ID);
  });

  it('does not retain the keypair in hook state after deploy returns', async () => {
    const deployClient: DeployClient = {
      deployAccount: vi
        .fn()
        .mockResolvedValue({ contractId: MOCK_CONTRACT_ID, txHash: MOCK_TX_HASH }),
      getDeployedContractId: vi.fn().mockResolvedValue(null),
    };

    const { result } = await setupOnboarding(deployClient);

    await act(async () => {
      await result.current.deployAccount('testnet');
    });

    // No keypair / secret material is exposed on the hook's returned state.
    const exposed = JSON.stringify(result.current.account ?? {});
    const secret = deriveKeypairFromMnemonic(MNEMONIC, 0).secret();
    expect(exposed).not.toContain(secret);
    // Plaintext mnemonic is cleared from state.
    expect(result.current.mnemonic).toBeNull();
  });

  it('recovers an existing contract id on reimport without redeploying', async () => {
    // Deploy client short-circuits: contract already exists, so it returns the
    // existing id with no txHash (alreadyDeployed).
    const deployAccount = vi.fn().mockResolvedValue({ contractId: MOCK_CONTRACT_ID });
    const deployClient: DeployClient = {
      deployAccount,
      getDeployedContractId: vi.fn().mockResolvedValue(MOCK_CONTRACT_ID),
    };

    const { result } = await setupOnboarding(deployClient);

    await act(async () => {
      await result.current.deployAccount('testnet');
    });

    expect(result.current.account?.contractId).toBe(MOCK_CONTRACT_ID);
    expect(result.current.account?.txHash).toBeUndefined();
    expect(result.current.account?.alreadyDeployed).toBe(true);

    const expectedKeypair = deriveKeypairFromMnemonic(MNEMONIC, 0);
    const stored = useAccountStore
      .getState()
      .accounts.find((a) => a.id === expectedKeypair.publicKey());
    expect(stored?.contractId).toBe(MOCK_CONTRACT_ID);
  });

  it('surfaces a readable error and keeps the mnemonic for retry on failure', async () => {
    const deployAccount = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unreachable'))
      .mockResolvedValueOnce({ contractId: MOCK_CONTRACT_ID, txHash: MOCK_TX_HASH });
    const deployClient: DeployClient = {
      deployAccount,
      getDeployedContractId: vi.fn().mockResolvedValue(null),
    };

    const { result } = await setupOnboarding(deployClient);

    await act(async () => {
      await result.current.deployAccount('testnet');
    });

    // Error surfaced, mnemonic retained so the user can retry.
    expect(result.current.error).toBe('Network unreachable');
    expect(result.current.account).toBeNull();
    expect(result.current.mnemonic).toBe(MNEMONIC);

    // Retry succeeds without re-seeding the mnemonic.
    await act(async () => {
      await result.current.deployAccount('testnet');
    });

    expect(deployAccount).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.account?.contractId).toBe(MOCK_CONTRACT_ID);
  });
});
