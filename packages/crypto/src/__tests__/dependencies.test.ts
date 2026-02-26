/**
 * Dependency verification test
 * Verifies all required dependencies are installed and importable
 */

describe('Dependencies', () => {
  it('should import @stellar/stellar-sdk', async () => {
    const stellar = await import('@stellar/stellar-sdk');
    expect(stellar).toBeDefined();
    expect(stellar.Keypair).toBeDefined();
  });

  it('should import @noble/hashes', async () => {
    const hashes = await import('@noble/hashes/pbkdf2');
    expect(hashes).toBeDefined();
    expect(hashes.pbkdf2).toBeDefined();
  });

  it('should import @noble/ciphers', async () => {
    const { xchacha20poly1305 } = await import('@noble/ciphers/chacha.js');
    expect(xchacha20poly1305).toBeDefined();
  });

  it('should import bip39', async () => {
    const bip39 = await import('bip39');
    expect(bip39).toBeDefined();
    expect(bip39.generateMnemonic).toBeDefined();
    expect(bip39.validateMnemonic).toBeDefined();
  });

  it('should import zxcvbn', async () => {
    const zxcvbn = await import('zxcvbn');
    expect(zxcvbn).toBeDefined();
    expect(typeof zxcvbn.default).toBe('function');
  });

  it('should import fast-check for property-based testing', async () => {
    const fc = await import('fast-check');
    expect(fc).toBeDefined();
    expect(fc.assert).toBeDefined();
    expect(fc.property).toBeDefined();
  });
});
