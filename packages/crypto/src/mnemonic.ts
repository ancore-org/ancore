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
 * Validates a BIP39 mnemonic phrase.
 * 
 * @param {string} mnemonic - The mnemonic phrase to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}
