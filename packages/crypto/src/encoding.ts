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
