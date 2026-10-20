import { Keypair } from '@stellar/stellar-sdk';

/**
 * Import a Stellar keypair from a raw 32-byte Ed25519 seed with strict validation.
 *
 * @param seed - Raw 32-byte Ed25519 seed (Buffer or Uint8Array)
 * @returns Stellar keypair derived from the seed
 * @throws TypeError if seed is not exactly 32 bytes
 */
export function importFromRawEd25519Seed(seed: Buffer | Uint8Array): Keypair {
  if (!seed || (!(seed instanceof Buffer) && !(seed instanceof Uint8Array))) {
    throw new TypeError('Seed must be a Buffer or Uint8Array');
  }

  if (seed.byteLength !== 32) {
    throw new TypeError('Seed must be exactly 32 bytes');
  }

  return Keypair.fromRawEd25519Seed(seed);
}
