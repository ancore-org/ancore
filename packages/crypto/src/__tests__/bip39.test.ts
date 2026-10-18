import { isValidMnemonicChecksum } from '../bip39';
import * as bip39 from 'bip39';
import vectors from './vectors/mnemonic-strength-vectors.json';

describe('isValidMnemonicChecksum', () => {
  it('returns true for canonical valid 12-word mnemonic', () => {
    const valid12 =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(isValidMnemonicChecksum(valid12)).toBe(true);
  });

  it('returns true for canonical valid 24-word mnemonic', () => {
    const valid24 =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    expect(isValidMnemonicChecksum(valid24)).toBe(true);
  });

  it('returns true for randomly generated valid 12 and 24 word mnemonics', () => {
    const random12 = bip39.generateMnemonic(128);
    expect(isValidMnemonicChecksum(random12)).toBe(true);

    const random24 = bip39.generateMnemonic(256);
    expect(isValidMnemonicChecksum(random24)).toBe(true);
  });

  it('handles runs of extra whitespace and trims properly', () => {
    const padded =
      '  abandon   abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about  ';
    expect(isValidMnemonicChecksum(padded)).toBe(true);
  });

  it('returns false for phrase with corrupted final checksum word', () => {
    // In "abandon ... about", "about" carries the valid checksum. Replacing "about" with "abandon" corrupts checksum.
    const corruptedFinalWord12 =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    expect(isValidMnemonicChecksum(corruptedFinalWord12)).toBe(false);

    // In 24 words, "art" is the valid checksum word. Replacing with "abandon" corrupts checksum.
    const corruptedFinalWord24 =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    expect(isValidMnemonicChecksum(corruptedFinalWord24)).toBe(false);
  });

  it('returns false when words are corrupted or not in wordlist', () => {
    const unknownWord =
      'notabipword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(isValidMnemonicChecksum(unknownWord)).toBe(false);
  });

  it('returns false for non-supported lengths (e.g. 3, 11, 15, 25 words)', () => {
    expect(isValidMnemonicChecksum('abandon abandon about')).toBe(false);

    const words11 =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    expect(isValidMnemonicChecksum(words11)).toBe(false);

    const valid15 = bip39.generateMnemonic(160);
    expect(isValidMnemonicChecksum(valid15)).toBe(false);
  });

  it('returns false for empty string, whitespace, or invalid types', () => {
    expect(isValidMnemonicChecksum('')).toBe(false);
    expect(isValidMnemonicChecksum('   ')).toBe(false);
    expect(isValidMnemonicChecksum(null as unknown as string)).toBe(false);
    expect(isValidMnemonicChecksum(undefined as unknown as string)).toBe(false);
    expect(isValidMnemonicChecksum(123 as unknown as string)).toBe(false);
  });

  it('validates test vectors from mnemonic-strength-vectors.json', () => {
    for (const vector of vectors.vectors) {
      const result = isValidMnemonicChecksum(vector.input);
      if (!vector.expectThrow) {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    }
  });
});
