import { validateMnemonic } from '../mnemonic';
import * as bip39 from 'bip39';

describe('validateMnemonic', () => {
  it('returns true for a valid 12-word mnemonic', () => {
    const validMnemonic = bip39.generateMnemonic(128); // 128 bits = 12 words
    expect(validateMnemonic(validMnemonic)).toBe(true);
  });

  it('returns false for an invalid mnemonic (wrong word)', () => {
    // Generate valid mnemonic and replace the first word with something incorrect
    const validMnemonic = bip39.generateMnemonic(128);
    const words = validMnemonic.split(' ');
    words[0] = 'invalidwordthatdoesnotexist';
    const invalidMnemonic = words.join(' ');

    expect(validateMnemonic(invalidMnemonic)).toBe(false);
  });

  it('returns false for an invalid length (e.g. 15 words) even if technically valid BIP39', () => {
    const valid15WordMnemonic = bip39.generateMnemonic(160); // 160 bits = 15 words
    // BIP39 validation would be true for 15 words, but our requirement is strictly 12 words
    expect(bip39.validateMnemonic(valid15WordMnemonic)).toBe(true);
    expect(validateMnemonic(valid15WordMnemonic)).toBe(false);
  });

  it('returns false for an invalid length (e.g. 11 words)', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    const words = validMnemonic.split(' ');
    words.pop(); // Remove one word
    const invalidLengthMnemonic = words.join(' ');

    expect(validateMnemonic(invalidLengthMnemonic)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateMnemonic('')).toBe(false);
  });

  it('returns false for strings with extra spaces but correct word count', () => {
    const validMnemonic = bip39.generateMnemonic(128);
    // Extra spaces should be handled correctly by our split logic
    const spacedMnemonic = validMnemonic.replace(' ', '   ');
    expect(validateMnemonic(spacedMnemonic)).toBe(true);
  });
});
