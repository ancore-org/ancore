import { webcrypto } from 'node:crypto';

/** Force Node webcrypto — jsdom's subtle is incomplete on some Linux CI runners. */
export function ensureWebCrypto(): void {
  // globalThis.crypto is declared non-optional, so delete needs an optional view.
  const global = globalThis as unknown as { crypto?: Crypto };
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
