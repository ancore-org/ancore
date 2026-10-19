import { Keypair } from '@stellar/stellar-sdk';

/**
 * Validates and imports a raw 32-byte Ed25519 seed into a Stellar Keypair.
 *
 * @param seed - 32-byte Buffer or Uint8Array
 * @returns Stellar Keypair
 * @throws {TypeError} if seed is not Buffer/Uint8Array or its byteLength is not 32
 */
export function importRawEd25519Seed(seed: Uint8Array | Buffer): Keypair {
  if (
    !seed ||
    !(seed instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(seed)))
  ) {
    throw new TypeError('Seed must be exactly 32 bytes');
  }

  if (seed.byteLength !== 32) {
    throw new TypeError('Seed must be exactly 32 bytes');
  }

  const buf = Buffer.isBuffer(seed)
    ? seed
    : Buffer.from(seed.buffer, seed.byteOffset, seed.byteLength);

  return Keypair.fromRawEd25519Seed(buf);
}
