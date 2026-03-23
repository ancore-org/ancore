import { Keypair } from '@stellar/stellar-sdk';

export interface KeyPair {
  publicKey: string; // Stellar G... address
  secretKey: string; // Stellar S... secret
}

/**
 * Derives a Stellar KeyPair from a raw 32-byte seed.
 * The seed must not be logged or exposed.
 */
export function deriveKeyPair(seed: Uint8Array): KeyPair {
  if (seed.length !== 32) {
    throw new Error('seed must be exactly 32 bytes');
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
