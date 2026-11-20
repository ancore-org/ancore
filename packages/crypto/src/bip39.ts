import * as bip39 from 'bip39';
import { assertEnglishMnemonic } from './mnemonic';

/**
 * Validates whether a mnemonic phrase has a valid BIP39 checksum
 * and valid English BIP39 words.
 *
 * Checks that:
 * 1. The input is a valid non-empty string.
 * 2. The word count is a valid BIP39 length (12 or 24 words).
 * 3. Every word belongs to the standard English BIP39 wordlist.
 * 4. The SHA-256 checksum bits (embedded in the final word) match the entropy.
 *
 * @param phrase - The mnemonic phrase to validate.
 * @returns true if the mnemonic phrase has a valid word count, valid words, and a valid BIP39 checksum; false otherwise.
 */
export function isValidMnemonicChecksum(phrase: string): boolean {
  if (!phrase || typeof phrase !== 'string') {
    return false;
  }

  const trimmed = phrase.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const words = trimmed.split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    return false;
  }

  const normalized = words.join(' ');

  try {
    assertEnglishMnemonic(normalized);
  } catch {
    return false;
  }

  return bip39.validateMnemonic(normalized);
}
