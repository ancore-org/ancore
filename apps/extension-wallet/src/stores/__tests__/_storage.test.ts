import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * chrome.storage surfaces failures only via chrome.runtime.lastError inside the
 * callback. These tests install a fake chrome global before importing the
 * module, since extensionStorage picks its backend at module-evaluation time.
 */

type Callback = (result?: Record<string, unknown>) => void;

interface FakeChrome {
  runtime: { lastError?: { message?: string } | null };
  storage: {
    local: {
      get: (name: string, cb: Callback) => void;
      set: (items: Record<string, string>, cb: Callback) => void;
      remove: (name: string, cb: Callback) => void;
    };
  };
}

let fakeChrome: FakeChrome;

/** Make the next callback report a runtime error, as Chrome does on failure. */
function failNext(message: string) {
  fakeChrome.runtime.lastError = { message };
}

async function loadStorage() {
  vi.resetModules();
  const mod = await import('../_storage');
  return mod.extensionStorage;
}

beforeEach(() => {
  fakeChrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get: (_name, cb) => cb({}),
        set: (_items, cb) => cb(),
        remove: (_name, cb) => cb(),
      },
    },
  };
  vi.stubGlobal('chrome', fakeChrome);
  // Force the chrome branch rather than the webextension-polyfill one.
  vi.stubGlobal('browser', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('chrome extension storage adapter', () => {
  it('resolves getItem with the stored string', async () => {
    fakeChrome.storage.local.get = (name, cb) => cb({ [name]: 'stored-value' });
    const storage = await loadStorage();
    await expect(storage.getItem('k')).resolves.toBe('stored-value');
  });

  it('resolves getItem to null when the key is absent', async () => {
    const storage = await loadStorage();
    await expect(storage.getItem('missing')).resolves.toBeNull();
  });

  it('rejects getItem when chrome.runtime.lastError is set', async () => {
    fakeChrome.storage.local.get = (_name, cb) => {
      failNext('Extension context invalidated.');
      cb({});
    };
    const storage = await loadStorage();
    await expect(storage.getItem('k')).rejects.toThrow('Extension context invalidated.');
  });

  it('rejects setItem when the write fails instead of reporting success', async () => {
    fakeChrome.storage.local.set = (_items, cb) => {
      failNext('QUOTA_BYTES quota exceeded');
      cb();
    };
    const storage = await loadStorage();
    await expect(storage.setItem('k', 'v')).rejects.toThrow('QUOTA_BYTES quota exceeded');
  });

  it('rejects removeItem when the delete fails', async () => {
    fakeChrome.storage.local.remove = (_name, cb) => {
      failNext('Extension context invalidated.');
      cb();
    };
    const storage = await loadStorage();
    await expect(storage.removeItem('k')).rejects.toThrow('Extension context invalidated.');
  });

  it('resolves setItem and removeItem on success', async () => {
    const storage = await loadStorage();
    await expect(storage.setItem('k', 'v')).resolves.toBeUndefined();
    await expect(storage.removeItem('k')).resolves.toBeUndefined();
  });

  it('falls back to a generic message when lastError has no message', async () => {
    fakeChrome.storage.local.set = (_items, cb) => {
      fakeChrome.runtime.lastError = {};
      cb();
    };
    const storage = await loadStorage();
    await expect(storage.setItem('k', 'v')).rejects.toThrow(/Unknown runtime error/);
  });
});
