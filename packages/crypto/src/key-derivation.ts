import { validateMnemonic } from 'bip39';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha512 } from '@noble/hashes/sha2';
import * as ed25519HdKey from 'ed25519-hd-key';
import { Keypair } from '@stellar/stellar-sdk';

function mnemonicToSeedSync(mnemonic: string): Uint8Array {
  const enc = new TextEncoder();
  const mnemonicBytes = enc.encode(mnemonic.normalize('NFKD'));
  const saltBytes = enc.encode('mnemonic');
  return pbkdf2(sha512, mnemonicBytes, saltBytes, { c: 2048, dkLen: 64 });
}

/**
 * Derives a Stellar keypair from a BIP39 mnemonic phrase and account index.
 * Uses the standard BIP44 derivation path for Stellar: m/44'/148'/{index}'
 *
 * @param {string} mnemonic - The BIP39 mnemonic phrase (12 or 24 words)
 * @param {number} index - The account index (0-based)
 * @returns {Keypair} A Stellar keypair derived from the mnemonic and index
 * @throws {Error} If the mnemonic is invalid or index is negative
 */
export function deriveKeypairFromMnemonic(mnemonic: string, index: number): Keypair {
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }

  if (index < 0 || !Number.isInteger(index)) {
    throw new Error('Index must be a non-negative integer');
  }

  const seed = mnemonicToSeedSync(mnemonic);
  const path = `m/44'/148'/${index}'`;
  const seedHex = Array.from(seed)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const derivedKey = ed25519HdKey.derivePath(path, seedHex);

  return Keypair.fromRawEd25519Seed(derivedKey.key);
}

/**
 * Validates if a mnemonic can derive a valid Stellar keypair.
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
    keypairs.push(deriveKeypairFromMnemonic(mnemonic, startIndex + i));
  }
  return keypairs;
}
