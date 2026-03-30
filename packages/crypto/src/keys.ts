import { Keypair } from '@stellar/stellar-sdk';

export interface KeyPair {
  publicKey: string; // Stellar G... address
  secretKey: string; // Stellar S... secret
}

/**
 * Derives a Stellar KeyPair from a seed.
 * Accepts a 32-byte raw Ed25519 seed or a 64-byte BIP39 seed (uses first 32 bytes).
 */
export function deriveKeyPair(seed: Uint8Array): KeyPair {
  if (seed.length === 64) {
    // BIP39 seed — use first 32 bytes as Ed25519 seed
    seed = seed.slice(0, 32);
  } else if (seed.length !== 32) {
    throw new Error('seed must be 32 or 64 bytes');
  }
  const keypair = Keypair.fromRawEd25519Seed(Buffer.from(seed));
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}

/** Returns the Stellar public key (G...) for a given secret key (S...) */
export function publicKeyFromSecret(secretKey: string): string {
  try {
    return Keypair.fromSecret(secretKey).publicKey();
  } catch {
    throw new Error('invalid secret key');
  }
}
