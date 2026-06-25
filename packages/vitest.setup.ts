/**
 * Shared Vitest setup for React/jsdom apps and packages.
 *
 * Provides:
 *   - @testing-library/jest-dom matchers
 *   - Automatic DOM cleanup after each test
 *   - Deterministic localStorage (falls back to in-memory when jsdom stub is broken)
 *
 * Referenced by `setupFiles` in every Vitest config that targets a browser/jsdom env.
 */

import '@testing-library/jest-dom';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { ensureWebCrypto } from './ensure-webcrypto';

function ensureBinaryCodec(): void {
  globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
  globalThis.atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
}

ensureWebCrypto();
ensureBinaryCodec();

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // jsdom can replace crypto after setupFiles; re-apply before every test.
  ensureWebCrypto();
  ensureBinaryCodec();

  // Prevent extension API mocks from leaking between test files in CI.
  delete (globalThis as { chrome?: unknown }).chrome;
  delete (globalThis as { browser?: unknown }).browser;
  globalThis.localStorage?.clear?.();
});

// ── Deterministic localStorage ────────────────────────────────────────────────
// jsdom's localStorage is present but can be unreliable in some Vitest versions.
// Replace it with a simple in-memory implementation so tests behave identically
// in CI and locally.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

const hasUsableStorage =
  typeof globalThis.localStorage !== 'undefined' &&
  typeof globalThis.localStorage.setItem === 'function' &&
  typeof globalThis.localStorage.getItem === 'function' &&
  typeof globalThis.localStorage.clear === 'function';

if (!hasUsableStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
  });
}
