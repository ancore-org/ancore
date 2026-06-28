import { Buffer } from 'node:buffer';
import { Keypair } from '@stellar/stellar-sdk';
import type { SignatureServiceContract } from '../types/contracts';

/**
 * Real Ed25519 signature verification via @stellar/stellar-sdk.
 *
 * Both `publicKey` and `signature` are expected as hex-encoded strings.
 * `payload` is the canonical UTF-8 message that was signed.
 *
 * Key format: 64-char lowercase hex representing a 32-byte Ed25519 public key
 * (NOT the Stellar StrKey / G... format — raw bytes).
 */
export class Ed25519SignatureService implements SignatureServiceContract {
  verify(publicKey: string, payload: string, signature: string): boolean {
    try {
      const pubKeyBytes = Buffer.from(publicKey, 'hex');
      const sigBytes = Buffer.from(signature, 'hex');
      const msgBytes = Buffer.from(payload, 'utf8');

      if (pubKeyBytes.length !== 32) return false;
      if (sigBytes.length !== 64) return false;

      // Stellar Keypair.fromRawEd25519Seed expects the 32-byte seed, but for
      // public-key-only verification we reconstruct a StrKey so Keypair.verify
      // can be used without the private key.
      const strKey = encodeEd25519PublicKey(pubKeyBytes);
      const kp = Keypair.fromPublicKey(strKey);
      return kp.verify(msgBytes, sigBytes);
    } catch {
      return false;
    }
  }
}

/**
 * Encode a raw 32-byte Ed25519 public key into Stellar StrKey (G... format).
 * Mirrors the encoding used by stellar-base internally.
 */
function encodeEd25519PublicKey(rawBytes: Buffer): string {
  // Version byte for Ed25519 public keys in Stellar StrKey is 6 << 3 = 48
  const VERSION_BYTE_ACCOUNT_ID = 6 << 3;
  const versionBuf = Buffer.from([VERSION_BYTE_ACCOUNT_ID]);
  const payload = Buffer.concat([versionBuf, rawBytes]);
  const checksum = crc16xmodem(payload);
  const checksumBuf = Buffer.alloc(2);
  checksumBuf.writeUInt16LE(checksum);
  const full = Buffer.concat([payload, checksumBuf]);
  return base32Encode(full);
}

function crc16xmodem(buf: Buffer): number {
  let crc = 0x0000;
  for (const byte of buf) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}
