import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_UNLOCK_ATTEMPT_STATE,
  UNLOCK_ATTEMPT_STORAGE_KEY,
  clearUnlockAttemptState,
  loadUnlockAttemptState,
  saveUnlockAttemptState,
} from '../unlock-rate-limit';

type StorageArea = {
  get: (keys: string | string[] | null, callback: (items: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
  remove: (keys: string | string[], callback?: () => void) => void;
  clear: (callback?: () => void) => void;
};

function createFakeStorageArea(): StorageArea {
  let store: Record<string, unknown> = {};

  return {
    get(keys, callback) {
      if (keys === null) {
        callback({ ...store });
        return;
      }
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (Object.prototype.hasOwnProperty.call(store, key)) {
          result[key] = store[key];
        }
      }
      callback(result);
    },
    set(items, callback) {
      store = { ...store, ...items };
      callback?.();
    },
    remove(keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) {
        delete store[key];
      }
      callback?.();
    },
    clear(callback) {
      store = {};
      callback?.();
    },
  };
}

function installChrome(storageArea: StorageArea | undefined): void {
  const chromeMock: Record<string, unknown> = {};
  if (storageArea) {
    chromeMock.storage = { session: storageArea };
  }
  (globalThis as unknown as { chrome?: unknown }).chrome = chromeMock;
}

function readStoredRaw(): unknown {
  const chrome = (globalThis as unknown as { chrome: { storage: { session: StorageArea } } }).chrome;
  let captured: unknown;
  chrome.storage.session.get(UNLOCK_ATTEMPT_STORAGE_KEY, (items) => {
    captured = items[UNLOCK_ATTEMPT_STORAGE_KEY];
  });
  return captured;
}

function writeStoredRaw(value: unknown): void {
  const chrome = (globalThis as unknown as { chrome: { storage: { session: StorageArea } } }).chrome;
  chrome.storage.session.set({ [UNLOCK_ATTEMPT_STORAGE_KEY]: value });
}

describe('unlock-rate-limit persistence', () => {
  let storageArea: StorageArea;

  beforeEach(() => {
    storageArea = createFakeStorageArea();
    installChrome(storageArea);
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    vi.restoreAllMocks();
  });

  describe('loadUnlockAttemptState', () => {
    it('returns the default state when nothing is stored', () => {
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('returns the default state when chrome.storage.session is undefined', () => {
      installChrome(undefined);
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('returns the default state when chrome is undefined', () => {
      delete (globalThis as unknown as { chrome?: unknown }).chrome;
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('round trips a state saved via saveUnlockAttemptState', () => {
      const state = { failedAttempts: 3, lockedUntil: Date.now() + 60_000 };
      saveUnlockAttemptState(state);
      expect(loadUnlockAttemptState()).toEqual(state);
    });

    it('round trips a state with no lock', () => {
      const state = { failedAttempts: 0, lockedUntil: null };
      saveUnlockAttemptState(state);
      expect(loadUnlockAttemptState()).toEqual(state);
    });

    it('falls back to the default on corrupt JSON', () => {
      writeStoredRaw('{not valid json');
      expect(() => loadUnlockAttemptState()).not.toThrow();
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when the stored value is not a string', () => {
      writeStoredRaw({ failedAttempts: 5, lockedUntil: null });
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when the stored value is null', () => {
      writeStoredRaw(null);
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when the parsed payload is not an object', () => {
      writeStoredRaw(JSON.stringify(42));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when the parsed payload is an array', () => {
      writeStoredRaw(JSON.stringify([1, 2, 3]));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when the parsed payload is null', () => {
      writeStoredRaw(JSON.stringify(null));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when failedAttempts is not a number', () => {
      writeStoredRaw(JSON.stringify({ failedAttempts: '3', lockedUntil: null }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when failedAttempts is missing', () => {
      writeStoredRaw(JSON.stringify({ lockedUntil: null }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    // Negative and NaN failedAttempts are treated as corrupt data and reset to the
    // default state. A negative counter would otherwise grant extra attempts, and
    // NaN would break every comparison in the throttle logic.
    it('falls back to the default when failedAttempts is negative', () => {
      writeStoredRaw(JSON.stringify({ failedAttempts: -5, lockedUntil: null }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when failedAttempts is NaN', () => {
      writeStoredRaw(JSON.stringify({ failedAttempts: Number.NaN, lockedUntil: null }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when failedAttempts is Infinity', () => {
      writeStoredRaw(JSON.stringify({ failedAttempts: Number.POSITIVE_INFINITY, lockedUntil: null }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when lockedUntil has the wrong type', () => {
      writeStoredRaw(JSON.stringify({ failedAttempts: 2, lockedUntil: 'soon' }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('falls back to the default when lockedUntil is NaN', () => {
      writeStoredRaw(JSON.stringify({ failedAttempts: 2, lockedUntil: Number.NaN }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('resets to the default when the stored lock has expired', () => {
      writeStoredRaw(JSON.stringify({ failedAttempts: 4, lockedUntil: Date.now() - 1_000 }));
      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('keeps a state whose lock is still active', () => {
      const lockedUntil = Date.now() + 60_000;
      writeStoredRaw(JSON.stringify({ failedAttempts: 4, lockedUntil }));
      expect(loadUnlockAttemptState()).toEqual({ failedAttempts: 4, lockedUntil });
    });
  });

  describe('saveUnlockAttemptState', () => {
    it('stores the state under UNLOCK_ATTEMPT_STORAGE_KEY as a JSON string', () => {
      const state = { failedAttempts: 2, lockedUntil: null };
      saveUnlockAttemptState(state);

      const raw = readStoredRaw();
      expect(typeof raw).toBe('string');
      expect(JSON.parse(raw as string)).toEqual(state);
    });

    it('overwrites a previously stored state', () => {
      saveUnlockAttemptState({ failedAttempts: 1, lockedUntil: null });
      saveUnlockAttemptState({ failedAttempts: 5, lockedUntil: null });
      expect(loadUnlockAttemptState()).toEqual({ failedAttempts: 5, lockedUntil: null });
    });

    it('does not throw when chrome.storage.session is undefined', () => {
      installChrome(undefined);
      expect(() => saveUnlockAttemptState({ failedAttempts: 1, lockedUntil: null })).not.toThrow();
    });
  });

  describe('clearUnlockAttemptState', () => {
    it('writes the default state back', () => {
      saveUnlockAttemptState({ failedAttempts: 7, lockedUntil: Date.now() + 60_000 });
      clearUnlockAttemptState();

      expect(loadUnlockAttemptState()).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);

      const raw = readStoredRaw();
      expect(typeof raw).toBe('string');
      expect(JSON.parse(raw as string)).toEqual(DEFAULT_UNLOCK_ATTEMPT_STATE);
    });

    it('does not throw when chrome.storage.session is undefined', () => {
      installChrome(undefined);
      expect(() => clearUnlockAttemptState()).not.toThrow();
    });
  });

  describe('UNLOCK_ATTEMPT_STORAGE_KEY', () => {
    it('is the key used by saveUnlockAttemptState', () => {
      saveUnlockAttemptState({ failedAttempts: 1, lockedUntil: null });
      expect(readStoredRaw()).toBeDefined();
    });

    it('is a non-empty string', () => {
      expect(typeof UNLOCK_ATTEMPT_STORAGE_KEY).toBe('string');
      expect(UNLOCK_ATTEMPT_STORAGE_KEY.length).toBeGreaterThan(0);
    });
  });
});