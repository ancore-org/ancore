import { deriveKeypairFromMnemonic } from '@ancore/crypto';

import { discoverFundedHdAccounts } from '../wallet-discovery';

describe('discoverFundedHdAccounts', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('returns funded accounts within the scan range', async () => {
    const fundedKey = deriveKeypairFromMnemonic(mnemonic, 2);

    const discovered = await discoverFundedHdAccounts({
      mnemonic,
      startIndex: 0,
      endIndex: 5,
      fetchNativeBalance: async (publicKey) => {
        if (publicKey === fundedKey.publicKey()) {
          return '42.5000000';
        }

        return null;
      },
    });

    expect(discovered).toEqual([
      {
        accountIndex: 2,
        publicKey: fundedKey.publicKey(),
        balance: '42.5000000',
      },
    ]);
  });

  it('reports scan progress for each derived account', async () => {
    const onProgress = jest.fn();

    await discoverFundedHdAccounts({
      mnemonic,
      startIndex: 0,
      endIndex: 2,
      fetchNativeBalance: async () => null,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, { accountIndex: 0, scanned: 1, total: 3 });
    expect(onProgress).toHaveBeenNthCalledWith(3, { accountIndex: 2, scanned: 3, total: 3 });
  });

  it('stops scanning when the abort signal is triggered', async () => {
    const controller = new AbortController();
    let calls = 0;

    await expect(
      discoverFundedHdAccounts({
        mnemonic,
        startIndex: 0,
        endIndex: 5,
        signal: controller.signal,
        fetchNativeBalance: async () => {
          calls += 1;
          if (calls === 2) {
            controller.abort();
          }

          return null;
        },
      })
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(calls).toBe(2);
  });

  it('rejects invalid scan ranges', async () => {
    await expect(
      discoverFundedHdAccounts({
        mnemonic,
        startIndex: 3,
        endIndex: 1,
        fetchNativeBalance: async () => null,
      })
    ).rejects.toThrow(
      'endIndex must be a non-negative integer greater than or equal to startIndex.'
    );
  });
});
