import { generateMnemonic, validateMnemonic } from '../mnemonic';

describe('generateMnemonic', () => {
  it('should generate a 12-word mnemonic phrase', () => {
    const mnemonic = generateMnemonic();
    expect(mnemonic).toBeDefined();
    const words = mnemonic.split(/\s+/);
    expect(words).toHaveLength(12);
  });

  it('should generate a valid BIP39 mnemonic', () => {
    const mnemonic = generateMnemonic();
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('should provide different mnemonics each time', () => {
    const mnemonic1 = generateMnemonic();
    const mnemonic2 = generateMnemonic();
    expect(mnemonic1).not.toBe(mnemonic2);
  });
});
