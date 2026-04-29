function getCrypto(): Crypto {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure randomness API is not available in this environment.');
  }
  return globalThis.crypto;
}

export function randomBytes(length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0 || length > 65536) {
    throw new TypeError('Invalid byte length. Must be a positive integer between 0 and 65536.');
  }

  const crypto = getCrypto();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
