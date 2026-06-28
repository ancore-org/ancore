import { webcrypto } from 'node:crypto';

/** Force Node webcrypto — jsdom's subtle is incomplete on some Linux CI runners. */
export function ensureWebCrypto(): void {
  const global = globalThis as typeof globalThis & { crypto?: Crypto };
  try {
    delete global.crypto;
  } catch {
    // Non-configurable in some environments; fall through to defineProperty.
  }
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}

ensureWebCrypto();
