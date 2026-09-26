/**
 * Base58 codec.
 *
 * Hex and base64 live in signature-format.ts, which is the canonical codec for
 * this package and the one re-exported from index.ts. They are re-exported here
 * so importing this module directly cannot pick up a divergent implementation.
 */

export { toHex, fromHex, toBase64, fromBase64 } from './signature-format';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Encodes a Uint8Array to a base58 string */
export function toBase58(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('input must be a Uint8Array');
  }
  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }
  let result = '';
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % 58n)] + result;
    num /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = '1' + result;
  }
  return result;
}

/** Decodes a base58 string to Uint8Array */
export function fromBase58(s: string): Uint8Array {
  if (typeof s !== 'string' || !s.length) {
    throw new TypeError('invalid base58 string');
  }
  let num = 0n;
  for (const ch of s) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx === -1) throw new TypeError('invalid base58 string');
    num = num * 58n + BigInt(idx);
  }

  const digits: number[] = [];
  while (num > 0n) {
    digits.unshift(Number(num % 256n));
    num /= 256n;
  }

  let leadingZeros = 0;
  for (const ch of s) {
    if (ch !== '1') break;
    leadingZeros++;
  }

  const result = new Uint8Array(leadingZeros + digits.length);
  result.set(digits, leadingZeros);
  return result;
}
