import { sha256 } from './hashing';
import { toHex } from './encoding';

/**
 * Generates a short deterministic fingerprint for a public key or arbitrary
 * key material, suitable for device-trust confirmation UX.
 *
 * Format: 8 groups of 4 lowercase hex characters separated by colons.
 * Example: "a1b2:c3d4:e5f6:0123:4567:89ab:cdef:0011"
 *
 * The fingerprint is the first 16 bytes of SHA-256(key), hex-encoded and
 * split into 4-character groups. This gives 2^64 collision resistance —
 * sufficient for human-verified device confirmation.
 *
 * @param key - Public key string (e.g. Stellar G... address) or raw bytes.
 */
export function keyFingerprint(key: string | Uint8Array): string {
  const digest = sha256(key);
  const hex = toHex(digest.slice(0, 16)); // 16 bytes → 32 hex chars
  return hex.match(/.{4}/g)!.join(':'); // 8 groups of 4 → "xxxx:xxxx:..."
}
