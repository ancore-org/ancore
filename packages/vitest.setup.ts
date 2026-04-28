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
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
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
