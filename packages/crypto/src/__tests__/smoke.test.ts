import * as CryptoAPI from '../index';

const EXPECTED_EXPORTS = [
  'CRYPTO_VERSION',
  'verifySignature',
  'validatePasswordStrength',
  'encryptSecretKey',
  'decryptSecretKey',
  'generateMnemonic',
  'validateMnemonic',
  'deriveKeypairFromMnemonic',
  'validateMnemonicForStellar',
  'deriveMultipleKeypairsFromMnemonic',
] as const;

describe('@ancore/crypto smoke test', () => {
  let consoleSpy: {
    log: ReturnType<typeof jest.spyOn>;
    warn: ReturnType<typeof jest.spyOn>;
    error: ReturnType<typeof jest.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports every symbol in the public API', () => {
    for (const symbol of EXPECTED_EXPORTS) {
      expect(CryptoAPI[symbol]).toBeDefined();
    }
  });

  it('has no undeclared exports', () => {
    const actualKeys = Object.keys(CryptoAPI).sort();
    const expectedKeys = [...EXPECTED_EXPORTS].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });

  it('resolves each export to the same reference on repeated access', () => {
    for (const symbol of EXPECTED_EXPORTS) {
      expect(CryptoAPI[symbol]).toBe(CryptoAPI[symbol]);
    }
  });

  it('does not log to console when calling verifySignature with valid inputs', async () => {
    const { Keypair } = await import('@stellar/stellar-sdk');
    const seed = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
    const keypair = Keypair.fromRawEd25519Seed(seed);
    const message = 'smoke test message';
    const sig = keypair.sign(Buffer.from(message));

    await CryptoAPI.verifySignature(
      message,
      Buffer.from(sig).toString('base64'),
      keypair.publicKey()
    );

    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).not.toHaveBeenCalled();
  });

  it('verifySignature resolves to true for a valid signature', async () => {
    const { Keypair } = await import('@stellar/stellar-sdk');
    const seed = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
    const keypair = Keypair.fromRawEd25519Seed(seed);
    const message = 'smoke test';
    const sig = keypair.sign(Buffer.from(message));

    await expect(
      CryptoAPI.verifySignature(message, Buffer.from(sig).toString('base64'), keypair.publicKey())
    ).resolves.toBe(true);
  });

  it('CRYPTO_VERSION is a non-empty string', () => {
    expect(typeof CryptoAPI.CRYPTO_VERSION).toBe('string');
    expect(CryptoAPI.CRYPTO_VERSION.length).toBeGreaterThan(0);
  });
});
