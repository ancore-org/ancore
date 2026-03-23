import * as bip39 from 'bip39';

export interface SeedResult {
  seed: Uint8Array; // 64-byte BIP39 seed
  mnemonic: string; // space-separated word list
}

/** Generates a new random 24-word BIP39 mnemonic and its seed */
export async function generateMnemonic(): Promise<SeedResult> {
  const mnemonic = bip39.generateMnemonic(256); // 256 bits = 24 words
  const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
  return { mnemonic, seed: new Uint8Array(seedBuffer) };
}

/** Derives a 64-byte seed from an existing BIP39 mnemonic */
export async function mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('invalid mnemonic phrase');
  }
  const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
  return new Uint8Array(seedBuffer);
}
