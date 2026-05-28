/** Encodes a Uint8Array to a lowercase hex string */
export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/** Decodes a hex string to Uint8Array */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new TypeError('invalid hex string');
  }
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/** Encodes a Uint8Array to a base64 string */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Encodes a Uint8Array to a base58 string */
export function toBase58(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('input must be a Uint8Array');
  }
  let num = BigInt('0x' + (bytes.length ? Buffer.from(bytes).toString('hex') : '00'));
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
  const hex =
    num === 0n
      ? ''
      : num.toString(16).padStart(num.toString(16).length + (num.toString(16).length % 2), '0');
  const bytes = hex ? new Uint8Array(Buffer.from(hex, 'hex')) : new Uint8Array(0);
  let leadingZeros = 0;
  for (const ch of s) {
    if (ch !== '1') break;
    leadingZeros++;
  }
  const result = new Uint8Array(leadingZeros + bytes.length);
  result.set(bytes, leadingZeros);
  return result;
}

/** Decodes a base64 string to Uint8Array */
export function fromBase64(b64: string): Uint8Array {
  // Normalize padding before round-trip check so unpadded inputs are accepted
  const normalized = b64.replace(/=+$/, '');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const decoded = Buffer.from(padded, 'base64');
  if (decoded.toString('base64') !== padded) {
    throw new TypeError('invalid base64 string');
  }
  return new Uint8Array(decoded);
}
