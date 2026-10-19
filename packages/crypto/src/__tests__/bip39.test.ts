import * as bip39 from 'bip39';
import { isValidMnemonicChecksum } from '../mnemonic';

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const VALID_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon abandon abandon art';

describe('isValidMnemonicChecksum', () => {
  it('returns true for a valid 12-word mnemonic with correct checksum', () => {
    expect(isValidMnemonicChecksum(VALID_12)).toBe(true);
  });

  it('returns true for a valid 24-word mnemonic with correct checksum', () => {
    expect(isValidMnemonicChecksum(VALID_24)).toBe(true);
  });

  it('returns true for a freshly generated 12-word mnemonic', () => {
    expect(isValidMnemonicChecksum(bip39.generateMnemonic(128))).toBe(true);
  });

  it('returns true for a freshly generated 24-word mnemonic', () => {
    expect(isValidMnemonicChecksum(bip39.generateMnemonic(256))).toBe(true);
  });

  it('returns false when the final word is corrupted (bad checksum)', () => {
    // Replace the last word with a different valid BIP39 word so the
    // word-list check still passes but the checksum bits fail.
    const corrupted =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zoo';
    expect(isValidMnemonicChecksum(corrupted)).toBe(false);
  });

  it('returns false for a phrase with an unknown word', () => {
    const unknown = VALID_12.replace('about', 'notaword');
    expect(isValidMnemonicChecksum(unknown)).toBe(false);
  });

  it('returns false for a 15-word phrase (wrong length)', () => {
    expect(isValidMnemonicChecksum(bip39.generateMnemonic(160))).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidMnemonicChecksum('')).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(isValidMnemonicChecksum(null as unknown as string)).toBe(false);
    expect(isValidMnemonicChecksum(undefined as unknown as string)).toBe(false);
  });

  it('handles extra whitespace between words', () => {
    const spaced = VALID_12.replace(' abandon ', '  abandon  ');
    expect(isValidMnemonicChecksum(spaced)).toBe(true);
  });
});
