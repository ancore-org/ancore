import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAllExtensionStorage,
  clearChromeLocalStorage,
  clearChromeSessionStorage,
  getChromeLocalStorage,
  getChromeSessionStorage,
  removeChromeLocalStorage,
  removeChromeSessionStorage,
  setChromeLocalStorage,
  setChromeSessionStorage,
} from '../chrome-storage';

type StorageArea = {
  get: (keys: string | string[] | null, callback: (items: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
  remove: (keys: string | string[], callback?: () => void) => void;
  clear: (callback?: () => void) => void;
};

function createFakeStorageArea(): StorageArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};

  return {
    data,
    get(keys, callback) {
      if (keys === null) {
        callback({ ...data });
        return;
      }
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key in data) {
          result[key] = data[key];
        }
      }
      callback(result);
    },
    set(items, callback) {
      Object.assign(data, items);
      callback?.();
    },
    remove(keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) {
        delete data[key];
      }
      callback?.();
    },
    clear(callback) {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
      callback?.();
    },
  };
}

function createLocalStorageStub() {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    }),
  };
}

describe('chrome-storage', () => {
  let localArea: ReturnType<typeof createFakeStorageArea>;
  let sessionArea: ReturnType<typeof createFakeStorageArea>;
  let localStorageStub: ReturnType<typeof createLocalStorageStub>;

  beforeEach(() => {
    localArea = createFakeStorageArea();
    sessionArea = createFakeStorageArea();
    localStorageStub = createLocalStorageStub();

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: localArea,
        session: sessionArea,
      },
    };

    (globalThis as unknown as { localStorage: unknown }).localStorage = localStorageStub;
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    vi.restoreAllMocks();
  });

  describe('local storage helpers', () => {
    it('sets a value and reads it back through the fake local area', async () => {
      await setChromeLocalStorage('ancore:test', { hello: 'world' });

      expect(localArea.data['ancore:test']).toEqual({ hello: 'world' });

      const value = await getChromeLocalStorage<{ hello: string }>('ancore:test');
      expect(value).toEqual({ hello: 'world' });
    });

    it('returns undefined for a missing key', async () => {
      const value = await getChromeLocalStorage('ancore:missing');
      expect(value).toBeUndefined();
    });

    it('removes a value from the local area', async () => {
      await setChromeLocalStorage('ancore:test', 'value');
      expect(localArea.data['ancore:test']).toBe('value');

      await removeChromeLocalStorage('ancore:test');
      expect(localArea.data['ancore:test']).toBeUndefined();
    });

    it('clears only the local area', async () => {
      await setChromeLocalStorage('ancore:local', 'local-value');
      await setChromeSessionStorage('ancore:session', 'session-value');

      await clearChromeLocalStorage();

      expect(localArea.data).toEqual({});
      expect(sessionArea.data).toEqual({ 'ancore:session': 'session-value' });
    });
  });

  describe('session storage helpers', () => {
    it('sets a value and reads it back through the fake session area', async () => {
      await setChromeSessionStorage('ancore:session', { token: 'abc' });

      expect(sessionArea.data['ancore:session']).toEqual({ token: 'abc' });

      const value = await getChromeSessionStorage<{ token: string }>('ancore:session');
      expect(value).toEqual({ token: 'abc' });
    });

    it('returns undefined for a missing session key', async () => {
      const value = await getChromeSessionStorage('ancore:missing');
      expect(value).toBeUndefined();
    });

    it('removes a value from the session area', async () => {
      await setChromeSessionStorage('ancore:session', 'value');
      expect(sessionArea.data['ancore:session']).toBe('value');

      await removeChromeSessionStorage('ancore:session');
      expect(sessionArea.data['ancore:session']).toBeUndefined();
    });

    it('clears only the session area', async () => {
      await setChromeLocalStorage('ancore:local', 'local-value');
      await setChromeSessionStorage('ancore:session', 'session-value');

      await clearChromeSessionStorage();

      expect(sessionArea.data).toEqual({});
      expect(localArea.data).toEqual({ 'ancore:local': 'local-value' });
    });
  });

  describe('clearAllExtensionStorage', () => {
    it('clears both local and session areas', async () => {
      await setChromeLocalStorage('ancore:local', 'local-value');
      await setChromeSessionStorage('ancore:session', 'session-value');

      expect(localArea.data).toEqual({ 'ancore:local': 'local-value' });
      expect(sessionArea.data).toEqual({ 'ancore:session': 'session-value' });

      await clearAllExtensionStorage();

      expect(localArea.data).toEqual({});
      expect(sessionArea.data).toEqual({});
    });

    it('resolves when both areas are already empty', async () => {
      await expect(clearAllExtensionStorage()).resolves.toBeUndefined();
      expect(localArea.data).toEqual({});
      expect(sessionArea.data).toEqual({});
    });
  });

  describe('when chrome.storage.session is undefined', () => {
    beforeEach(() => {
      (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: {
          local: localArea,
        },
      };
    });

    it('does not throw when setting a session value', async () => {
      await expect(setChromeSessionStorage('ancore:session', 'value')).resolves.toBeUndefined();
    });

    it('does not throw when getting a session value', async () => {
      await expect(getChromeSessionStorage('ancore:session')).resolves.toBeUndefined();
    });

    it('does not throw when removing a session value', async () => {
      await expect(removeChromeSessionStorage('ancore:session')).resolves.toBeUndefined();
    });

    it('does not throw when clearing session storage', async () => {
      await expect(clearChromeSessionStorage()).resolves.toBeUndefined();
    });

    it('still clears local storage via clearAllExtensionStorage', async () => {
      await setChromeLocalStorage('ancore:local', 'local-value');

      await expect(clearAllExtensionStorage()).resolves.toBeUndefined();

      expect(localArea.data).toEqual({});
    });
  });

  describe('when chrome.storage.local is undefined', () => {
    beforeEach(() => {
      (globalThis as unknown as { chrome: unknown }).chrome = {
        storage: {
          session: sessionArea,
        },
      };
    });

    it('falls back to localStorage for set and get', async () => {
      await setChromeLocalStorage('ancore:fallback', { hello: 'world' });

      expect(localStorageStub.setItem).toHaveBeenCalled();

      const value = await getChromeLocalStorage<{ hello: string }>('ancore:fallback');
      expect(value).toEqual({ hello: 'world' });
    });

    it('does not throw when clearing local storage', async () => {
      await expect(clearChromeLocalStorage()).resolves.toBeUndefined();
    });
  });
});