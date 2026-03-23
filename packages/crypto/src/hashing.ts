import { sha256 as nobleSha256, sha512 as nobleSha512 } from '@noble/hashes/sha2';
import { hmac as nobleHmac } from '@noble/hashes/hmac';
import { TextEncoder } from 'node:util';

type HashInput = string | Uint8Array;

function toBytes(input: HashInput): Uint8Array {
  return typeof input === 'string' ? new TextEncoder().encode(input) : input;
}

/** Returns SHA-256 digest as Uint8Array */
export function sha256(input: HashInput): Uint8Array {
  return nobleSha256(toBytes(input));
}

/** Returns SHA-512 digest as Uint8Array */
export function sha512(input: HashInput): Uint8Array {
  return nobleSha512(toBytes(input));
}

/** Returns HMAC-SHA256 as Uint8Array */
export function hmac(key: HashInput, message: HashInput): Uint8Array {
  return nobleHmac(nobleSha256, toBytes(key), toBytes(message));
}
