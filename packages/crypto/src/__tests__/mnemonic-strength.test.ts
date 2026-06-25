import { validateMnemonicStrength, MnemonicValidationError } from '../mnemonic';
import * as bip39 from 'bip39';

describe('validateMnemonicStrength', () => {
  it('accepts a valid 12-word mnemonic', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    expect(() => validateMnemonicStrength(validMnemonic)).not.toThrow();
  });

  it('accepts a valid 24-word mnemonic', () => {
    const validMnemonic = bip39.generateMnemonic(256);
    expect(() => validateMnemonicStrength(validMnemonic)).not.toThrow();
  });

  it('throws INVALID_TYPE for empty string', () => {
    expect(() => validateMnemonicStrength('')).toThrow(MnemonicValidationError);
    try {
      validateMnemonicStrength('');
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('INVALID_TYPE');
      }
    }
  });

  it('throws INVALID_TYPE for null input', () => {
    expect(() => validateMnemonicStrength(null as unknown as string)).toThrow(
      MnemonicValidationError
    );
    try {
      validateMnemonicStrength(null as unknown as string);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('INVALID_TYPE');
      }
    }
  });

  it('throws INVALID_TYPE for undefined input', () => {
    expect(() => validateMnemonicStrength(undefined as unknown as string)).toThrow(
      MnemonicValidationError
    );
    try {
      validateMnemonicStrength(undefined as unknown as string);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('INVALID_TYPE');
      }
    }
  });

  it('throws INVALID_LENGTH for 11-word mnemonic', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    const words = validMnemonic.split(' ');
    words.pop();
    const invalidMnemonic = words.join(' ');

    expect(() => validateMnemonicStrength(invalidMnemonic)).toThrow(MnemonicValidationError);
    try {
      validateMnemonicStrength(invalidMnemonic);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('INVALID_LENGTH');
        expect(err.message).toContain('11');
      }
    }
  });

  it('throws INVALID_LENGTH for 13-word mnemonic', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    const words = validMnemonic.split(' ');
    words.push('abandon'); // Add a valid word to make it 13
    const invalidMnemonic = words.join(' ');

    expect(() => validateMnemonicStrength(invalidMnemonic)).toThrow(MnemonicValidationError);
    try {
      validateMnemonicStrength(invalidMnemonic);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('INVALID_LENGTH');
        expect(err.message).toContain('13');
      }
    }
  });

  it('throws UNKNOWN_WORDS for mnemonic with typo', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    const words = validMnemonic.split(' ');
    words[0] = 'invalidwordthatdoesnotexist';
    const invalidMnemonic = words.join(' ');

    expect(() => validateMnemonicStrength(invalidMnemonic)).toThrow(MnemonicValidationError);
    try {
      validateMnemonicStrength(invalidMnemonic);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('UNKNOWN_WORDS');
        expect(err.details).toContain('invalidwordthatdoesnotexist');
      }
    }
  });

  it('throws INVALID_CHECKSUM for mnemonic with wrong checksum', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    const words = validMnemonic.split(' ');
    // Swap last two words to break checksum
    const last = words[words.length - 1];
    const secondLast = words[words.length - 2];
    words[words.length - 1] = secondLast;
    words[words.length - 2] = last;
    const invalidMnemonic = words.join(' ');

    expect(() => validateMnemonicStrength(invalidMnemonic)).toThrow(MnemonicValidationError);
    try {
      validateMnemonicStrength(invalidMnemonic);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('INVALID_CHECKSUM');
      }
    }
  });

  it('handles extra whitespace correctly', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    const spacedMnemonic = validMnemonic.replace(/ /g, '   ');
    expect(() => validateMnemonicStrength(spacedMnemonic)).not.toThrow();
  });

  it('throws UNKNOWN_WORDS for non-English wordlist words', () => {
    // Use 12 words total: 6 non-English BIP39 words + 6 valid English words
    // This passes the length check (12 words) but fails the wordlist check
    const invalidMnemonic =
      'página biblioteca école escuela bibliothek abandon abandon abandon abandon abandon abandon abandon';
    expect(() => validateMnemonicStrength(invalidMnemonic)).toThrow(MnemonicValidationError);
    try {
      validateMnemonicStrength(invalidMnemonic);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.code).toBe('UNKNOWN_WORDS');
      }
    }
  });

  it('provides details field for debugging', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    const words = validMnemonic.split(' ');
    words[0] = 'typoword';
    const invalidMnemonic = words.join(' ');

    try {
      validateMnemonicStrength(invalidMnemonic);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MnemonicValidationError);
      if (err instanceof MnemonicValidationError) {
        expect(err.details).toBeDefined();
        expect(typeof err.details).toBe('string');
      }
    }
  });
});
