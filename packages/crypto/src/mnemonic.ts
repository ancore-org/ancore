import * as bip39 from 'bip39';

/**
 * Generates a standard BIP39 12-word mnemonic phrase.
 * Uses secure randomness provided by the environment.
 *
 * @returns {string} A 12-word mnemonic phrase.
 */
export function generateMnemonic(): string {
  // bip39.generateMnemonic(128) generates a 12-word mnemonic.
  // Entropy for 12 words is 128 bits.
  return bip39.generateMnemonic(128);
}

/**
 * Validates a given mnemonic phrase.
 * Ensures the phrase is a valid BIP39 12-word mnemonic.
 *
 * @param mnemonic - The mnemonic phrase to validate
 * @returns true if the mnemonic is a valid 12-word BIP39 mnemonic, false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || typeof mnemonic !== 'string') {
    return false;
  }

  // Ensure it's exactly 12 words
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12) {
    return false;
  }

  const normalizedMnemonic = words.join(' ');

  // Validate against BIP39 wordlist and checksum
  return bip39.validateMnemonic(normalizedMnemonic);
}
