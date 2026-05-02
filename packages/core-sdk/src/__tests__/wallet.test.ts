import { decryptSecretKey, generateMnemonic } from '@ancore/crypto';

import { createWallet, deriveContractId, importWallet, restoreWallet } from '../wallet';

describe('wallet material helpers', () => {
  it('creates deterministic wallet material when importing the generated mnemonic', async () => {
    const created = await createWallet({ password: 'Correct-Horse-Battery-42!' });
    const imported = await importWallet({
      mnemonic: created.mnemonic,
      password: 'Correct-Horse-Battery-42!',
    });

    expect(imported.publicKey).toBe(created.publicKey);
    expect(imported.secretKey).toBe(created.secretKey);
    expect(imported.contractId).toBe(created.contractId);
    expect(imported.accountIndex).toBe(0);
    expect(created.encryptedMnemonic).toBeDefined();
  });

  it('restores the same wallet material from encrypted mnemonic payloads', async () => {
    const password = 'Correct-Horse-Battery-42!';
    const created = await createWallet({ password, accountIndex: 2 });
    const restored = await restoreWallet({
      encryptedMnemonic: created.encryptedMnemonic!,
      password,
      accountIndex: 2,
    });

    expect(restored.mnemonic).toBe(created.mnemonic);
    expect(restored.publicKey).toBe(created.publicKey);
    expect(restored.secretKey).toBe(created.secretKey);
    expect(restored.contractId).toBe(created.contractId);
  });

  it('round-trips encrypted mnemonics with the same password used for restoration', async () => {
    const password = 'Correct-Horse-Battery-42!';
    const created = await createWallet({ password });

    const restoredMnemonic = await decryptSecretKey(created.encryptedMnemonic!, password);

    expect(restoredMnemonic).toBe(created.mnemonic);
  });

  it('rejects malformed mnemonics during import', async () => {
    await expect(importWallet({ mnemonic: 'not a real mnemonic' })).rejects.toThrow(
      'mnemonic must be a valid 12-word BIP39 phrase.'
    );
  });

  it('rejects invalid account indices', async () => {
    await expect(createWallet({ accountIndex: -1 })).rejects.toThrow(
      'accountIndex must be a non-negative integer.'
    );
  });

  it('rejects restoration with the wrong password', async () => {
    const created = await createWallet({ password: 'Correct-Horse-Battery-42!' });

    await expect(
      restoreWallet({
        encryptedMnemonic: created.encryptedMnemonic!,
        password: 'wrong-password',
      })
    ).rejects.toThrow('Invalid password or corrupted encrypted payload.');
  });

  it('derives the placeholder contract id deterministically from the public key', async () => {
    const wallet = await importWallet({ mnemonic: generateMnemonic() });

    expect(deriveContractId(wallet.publicKey)).toBe(wallet.contractId);
    expect(wallet.contractId).toMatch(/^CAS[A-Z2-7]{55}$/);
  });
});
