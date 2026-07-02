/**
 * Unit tests for create-wallet.ts orchestration.
 *
 * All @ancore/crypto dependencies are mocked so tests run in pure Node without
 * needing WASM, real entropy, or real PBKDF2. The AncoreClient.createWallet
 * delegation path is also exercised via a separate describe block.
 *
 * Uses Jest globals (no import from 'jest'/'vitest') — consistent with the
 * rest of the core-sdk test suite.
 */

// ─── Mock @ancore/crypto ──────────────────────────────────────────────────────

const MOCK_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const MOCK_KEYPAIR = {
  publicKey: () => 'GABC1234PUBLICKEY',
  secret: () => 'SABC1234SECRETKEY',
};

const MOCK_ENCRYPTED_PAYLOAD = {
  salt: 'mock-salt',
  iv: 'mock-iv',
  data: 'mock-ciphertext',
};

jest.mock('@ancore/crypto', () => ({
  generateMnemonic: jest.fn(() => MOCK_MNEMONIC),
  deriveKeypairFromMnemonic: jest.fn(() => MOCK_KEYPAIR),
  encryptSecretKey: jest.fn(async () => MOCK_ENCRYPTED_PAYLOAD),
}));

// ─── Mock deriveContractId from wallet.ts ────────────────────────────────────

jest.mock('../wallet', () => ({
  deriveContractId: jest.fn((publicKey: string) => `C${publicKey.slice(1)}`),
}));

// ─── Mock @ancore/account-abstraction (needed by AncoreClient) ────────────────

jest.mock('@ancore/account-abstraction', () => ({
  AccountContract: jest.fn().mockImplementation(() => ({})),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { generateMnemonic, deriveKeypairFromMnemonic, encryptSecretKey } from '@ancore/crypto';
import { deriveContractId } from '../wallet';
import { createWallet, type CreateWalletResult } from '../create-wallet';
import { AncoreClient } from '../ancore-client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expectValidShape(result: CreateWalletResult): void {
  expect(result.mnemonic).toBe(MOCK_MNEMONIC);
  expect(result.publicKey).toBe('GABC1234PUBLICKEY');
  expect(result.secretKey).toBe('SABC1234SECRETKEY');
  expect(result.contractId).toBe('CABC1234PUBLICKEY');
}

// ─── createWallet() ───────────────────────────────────────────────────────────

describe('createWallet orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the correct wallet shape with default options', async () => {
    const result = await createWallet();

    expectValidShape(result);
    expect(result.accountIndex).toBe(0);
    expect(result.encryptedMnemonic).toBeUndefined();
  });

  it('calls generateMnemonic exactly once', async () => {
    await createWallet();
    expect(generateMnemonic).toHaveBeenCalledTimes(1);
  });

  it('calls deriveKeypairFromMnemonic with the generated mnemonic and default accountIndex 0', async () => {
    await createWallet();
    expect(deriveKeypairFromMnemonic).toHaveBeenCalledWith(MOCK_MNEMONIC, 0);
  });

  it('calls deriveKeypairFromMnemonic with the provided accountIndex', async () => {
    await createWallet({ accountIndex: 3 });
    expect(deriveKeypairFromMnemonic).toHaveBeenCalledWith(MOCK_MNEMONIC, 3);
  });

  it('returns the correct accountIndex in the result', async () => {
    const result = await createWallet({ accountIndex: 5 });
    expect(result.accountIndex).toBe(5);
  });

  it('does NOT call encryptSecretKey when no password is provided', async () => {
    await createWallet();
    expect(encryptSecretKey).not.toHaveBeenCalled();
  });

  it('calls encryptSecretKey with the mnemonic and password when password is provided', async () => {
    await createWallet({ password: 'hunter2' });
    expect(encryptSecretKey).toHaveBeenCalledWith(MOCK_MNEMONIC, 'hunter2');
  });

  it('includes encryptedMnemonic in result when password is provided', async () => {
    const result = await createWallet({ password: 'hunter2' });
    expect(result.encryptedMnemonic).toStrictEqual(MOCK_ENCRYPTED_PAYLOAD);
  });

  it('encryptedMnemonic is undefined when password is omitted', async () => {
    const result = await createWallet({});
    expect(result.encryptedMnemonic).toBeUndefined();
  });

  it('calls deriveContractId with the derived public key', async () => {
    await createWallet();
    expect(deriveContractId).toHaveBeenCalledWith('GABC1234PUBLICKEY');
  });

  it('returns contractId derived from publicKey via mock', async () => {
    const result = await createWallet();
    // mock: deriveContractId returns 'C' + publicKey.slice(1)
    expect(result.contractId).toBe('CABC1234PUBLICKEY');
  });

  it('throws when accountIndex is negative', async () => {
    await expect(createWallet({ accountIndex: -1 })).rejects.toThrow(
      'accountIndex must be a non-negative integer.'
    );
  });

  it('throws when accountIndex is a float', async () => {
    await expect(createWallet({ accountIndex: 1.5 })).rejects.toThrow(
      'accountIndex must be a non-negative integer.'
    );
  });

  it('accepts accountIndex of 0 (lower boundary)', async () => {
    const result = await createWallet({ accountIndex: 0 });
    expect(result.accountIndex).toBe(0);
  });

  it('accepts large accountIndex values', async () => {
    const result = await createWallet({ accountIndex: 999 });
    expect(result.accountIndex).toBe(999);
    expect(deriveKeypairFromMnemonic).toHaveBeenCalledWith(MOCK_MNEMONIC, 999);
  });
});

// ─── AncoreClient.createWallet delegation ────────────────────────────────────

describe('AncoreClient.createWallet', () => {
  let client: AncoreClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AncoreClient({ accountContractId: 'CTEST123' });
  });

  it('exists on the AncoreClient instance', () => {
    expect(typeof client.createWallet).toBe('function');
  });

  it('delegates to the createWallet orchestration function', async () => {
    const result = await client.createWallet();

    expect(generateMnemonic).toHaveBeenCalledTimes(1);
    expect(deriveKeypairFromMnemonic).toHaveBeenCalledWith(MOCK_MNEMONIC, 0);
    expectValidShape(result);
  });

  it('passes params through to the orchestration layer', async () => {
    await client.createWallet({ password: 'pass123', accountIndex: 2 });

    expect(deriveKeypairFromMnemonic).toHaveBeenCalledWith(MOCK_MNEMONIC, 2);
    expect(encryptSecretKey).toHaveBeenCalledWith(MOCK_MNEMONIC, 'pass123');
  });

  it('returns encryptedMnemonic when password is provided', async () => {
    const result = await client.createWallet({ password: 'pass123' });
    expect(result.encryptedMnemonic).toStrictEqual(MOCK_ENCRYPTED_PAYLOAD);
  });

  it('returns undefined encryptedMnemonic when no password is provided', async () => {
    const result = await client.createWallet();
    expect(result.encryptedMnemonic).toBeUndefined();
  });

  it('throws for negative accountIndex', async () => {
    await expect(client.createWallet({ accountIndex: -5 })).rejects.toThrow(
      'accountIndex must be a non-negative integer.'
    );
  });
});
