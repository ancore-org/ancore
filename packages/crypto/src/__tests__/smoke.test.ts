import * as CryptoAPI from '../index';

const EXPECTED_EXPORTS = [
  'CRYPTO_VERSION',
  // signing
  'verifySignature',
  'signMessage',
  // hashing
  'sha256',
  'sha512',
  'hmac',
  // keys
  'deriveKeyPair',
  'publicKeyFromSecret',
  // mnemonic
  'generateMnemonic',
  'mnemonicToSeed',
  // encoding
  'toHex',
  'fromHex',
  'toBase64',
  'fromBase64',
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

  // Property 1: All expected exports are defined
  it('exports every symbol in the public API', () => {
    for (const symbol of EXPECTED_EXPORTS) {
      expect(CryptoAPI[symbol]).toBeDefined();
    }
  });

  // Property 2: Export set matches the public API exactly (no extras, no missing)
  it('has no undeclared exports', () => {
    const actualKeys = Object.keys(CryptoAPI).sort();
    const expectedKeys = [...EXPECTED_EXPORTS].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });

  // Property 5: Module resolution is idempotent
  it('resolves each export to the same reference on repeated access', () => {
    for (const symbol of EXPECTED_EXPORTS) {
      expect(CryptoAPI[symbol]).toBe(CryptoAPI[symbol]);
    }
  });

  // Property 3: No console output during normal operation
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

  // Requirement 3.2: at least one async function resolves without throwing
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

  // Property 4: Error messages do not contain secret material
  it('does not include secret bytes in error messages from encoding functions', () => {
    const secret = new Uint8Array(32).fill(0xab);
    const secretHex = Buffer.from(secret).toString('hex');
    // Corrupt the secret hex to make it invalid (odd length triggers error)
    const corruptedSecretHex = secretHex + 'z';

    expect(() => CryptoAPI.fromHex(corruptedSecretHex)).toThrow();

    try {
      CryptoAPI.fromHex(corruptedSecretHex);
    } catch (e) {
      expect((e as Error).message).not.toContain(secretHex);
      expect((e as Error).message).not.toContain(corruptedSecretHex);
    }
  });

  it('CRYPTO_VERSION is a non-empty string', () => {
    expect(typeof CryptoAPI.CRYPTO_VERSION).toBe('string');
    expect(CryptoAPI.CRYPTO_VERSION.length).toBeGreaterThan(0);
  });
});
