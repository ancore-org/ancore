import { validateMnemonic, mnemonicToSeedSync } from 'bip39';
import * as ed25519HdKey from 'ed25519-hd-key';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * Derives a Stellar keypair from a BIP39 mnemonic phrase and account index.
 * Uses the standard BIP44 derivation path for Stellar: m/44'/148'/0'/0/{index}
 *
 * @param {string} mnemonic - The BIP39 mnemonic phrase (12 or 24 words)
 * @param {number} index - The account index (0-based)
 * @returns {Keypair} A Stellar keypair derived from the mnemonic and index
 * @throws {Error} If the mnemonic is invalid or index is negative
 */
export function deriveKeypairFromMnemonic(mnemonic: string, index: number): Keypair {
  // Validate inputs
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  if (index < 0 || !Number.isInteger(index)) {
    throw new Error('Index must be a non-negative integer');
  }

  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic);

  // Derive the path using BIP44 for Stellar: m/44'/148'/0'/0/{index}
  const path = `m/44'/148'/0'/0/${index}`;
  const derivedKey = ed25519HdKey.derivePath(path, seed.toString('hex'));

  // Create Stellar keypair from the derived private key
  return Keypair.fromRawEd25519Seed(derivedKey.key);
}

/**
 * Validates if a mnemonic can derive a valid Stellar keypair.
 *
 * @param {string} mnemonic - The BIP39 mnemonic phrase to validate
 * @returns {boolean} True if the mnemonic is valid and can derive keys
 */
export function validateMnemonicForStellar(mnemonic: string): boolean {
  try {
    deriveKeypairFromMnemonic(mnemonic, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derives multiple Stellar keypairs from a mnemonic phrase.
 *
 * @param {string} mnemonic - The BIP39 mnemonic phrase
 * @param {number} count - Number of keypairs to derive
 * @param {number} startIndex - Starting index (default: 0)
 * @returns {Keypair[]} Array of derived Stellar keypairs
 */
export function deriveMultipleKeypairsFromMnemonic(
  mnemonic: string,
  count: number,
  startIndex: number = 0
): Keypair[] {
  if (count <= 0 || !Number.isInteger(count)) {
    throw new Error('Count must be a positive integer');
  }

  if (startIndex < 0 || !Number.isInteger(startIndex)) {
    throw new Error('Start index must be a non-negative integer');
  }

  const keypairs: Keypair[] = [];

  for (let i = 0; i < count; i++) {
    const keypair = deriveKeypairFromMnemonic(mnemonic, startIndex + i);
    keypairs.push(keypair);
  }

  return keypairs;
}
