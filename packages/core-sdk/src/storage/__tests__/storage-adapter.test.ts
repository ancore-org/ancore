import {
  ChromeStorageAdapter,
  BrowserStorageAdapter,
  LocalStorageAdapter,
  StorageError,
  StorageErrorCode,
  createStorageAdapter,
} from '../storage-adapter';

// ─── Mock chrome.storage ──────────────────────────────────────────────────────

function makeChromeArea(store: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, cb: (r: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] });
    }),
    set: jest.fn((items: Record<string, unknown>, cb: () => void) => {
      Object.assign(store, items);
      cb();
    }),
    remove: jest.fn((key: string, cb: () => void) => {
      delete store[key];
      cb();
    }),
    getBytesInUse: jest.fn((_: null, cb: (n: number) => void) => cb(42)),
    QUOTA_BYTES: 5242880,
  };
}

// ─── ChromeStorageAdapter ─────────────────────────────────────────────────────

describe('ChromeStorageAdapter', () => {
  let store: Record<string, unknown>;
  let area: ReturnType<typeof makeChromeArea>;
  let adapter: ChromeStorageAdapter;

  beforeEach(() => {
    store = {};
    area = makeChromeArea(store);
    // Provide chrome.runtime.lastError = undefined (no error)
    (globalThis as any).chrome = { runtime: { lastError: undefined } };
    adapter = new ChromeStorageAdapter(area as any);
  });

  it('returns null for missing key', async () => {
    expect(await adapter.get('missing')).toBeNull();
  });

  it('sets and gets a value', async () => {
    await adapter.set('foo', { bar: 1 });
    expect(await adapter.get('foo')).toEqual({ bar: 1 });
  });

  it('removes a key', async () => {
    await adapter.set('del', 'value');
    await adapter.remove('del');
    expect(await adapter.get('del')).toBeNull();
  });

  it('returns quota info', async () => {
    const info = await adapter.getQuotaInfo();
    expect(info.bytesUsed).toBe(42);
    expect(info.quotaBytes).toBe(5242880);
  });

  it('maps chrome.runtime.lastError to StorageError on get', async () => {
    area.get.mockImplementationOnce((_key: string, cb: (r: Record<string, unknown>) => void) => {
      (globalThis as any).chrome.runtime.lastError = { message: 'quota exceeded' };
      cb({});
    });

    await expect(adapter.get('x')).rejects.toMatchObject({
      code: StorageErrorCode.QUOTA_EXCEEDED,
    });
  });

  it('maps chrome.runtime.lastError to StorageError on set', async () => {
    area.set.mockImplementationOnce((_items: Record<string, unknown>, cb: () => void) => {
      (globalThis as any).chrome.runtime.lastError = { message: 'quota exceeded' };
      cb();
    });

    await expect(adapter.set('x', 1)).rejects.toMatchObject({
      code: StorageErrorCode.QUOTA_EXCEEDED,
    });
  });
});

// ─── BrowserStorageAdapter ────────────────────────────────────────────────────

describe('BrowserStorageAdapter', () => {
  let store: Record<string, unknown>;
  let area: {
    get: jest.Mock;
    set: jest.Mock;
    remove: jest.Mock;
  };
  let adapter: BrowserStorageAdapter;

  beforeEach(() => {
    store = {};
    area = {
      get: jest.fn(async (key: string) => ({ [key]: store[key] })),
      set: jest.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: jest.fn(async (key: string) => {
        delete store[key];
      }),
    };
    adapter = new BrowserStorageAdapter(area as any);
  });

  it('returns null for missing key', async () => {
    expect(await adapter.get('missing')).toBeNull();
  });

  it('sets and gets a value', async () => {
    await adapter.set('hello', 'world');
    expect(await adapter.get('hello')).toBe('world');
  });

  it('removes a key', async () => {
    await adapter.set('k', 'v');
    await adapter.remove('k');
    expect(await adapter.get('k')).toBeNull();
  });

  it('maps thrown error to StorageError', async () => {
    area.get.mockRejectedValueOnce(new Error('permission denied'));
    await expect(adapter.get('x')).rejects.toMatchObject({
      code: StorageErrorCode.PERMISSION_DENIED,
    });
  });
});

// ─── LocalStorageAdapter ──────────────────────────────────────────────────────

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
  });

  it('returns null for missing key', async () => {
    expect(await adapter.get('nope')).toBeNull();
  });

  it('sets and gets a value', async () => {
    await adapter.set('key', { nested: true });
    expect(await adapter.get('key')).toEqual({ nested: true });
  });

  it('removes a key', async () => {
    await adapter.set('r', 1);
    await adapter.remove('r');
    expect(await adapter.get('r')).toBeNull();
  });

  it('throws StorageError on JSON parse failure', async () => {
    localStorage.setItem('bad', '{invalid json}');
    await expect(adapter.get('bad')).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── createStorageAdapter ─────────────────────────────────────────────────────

describe('createStorageAdapter', () => {
  it('returns LocalStorageAdapter when no browser APIs present', () => {
    const orig = (globalThis as any).chrome;
    const origBrowser = (globalThis as any).browser;
    delete (globalThis as any).chrome;
    delete (globalThis as any).browser;

    const adapter = createStorageAdapter();
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);

    (globalThis as any).chrome = orig;
    (globalThis as any).browser = origBrowser;
  });

  it('returns ChromeStorageAdapter when chrome.storage.local is present', () => {
    const origBrowser = (globalThis as any).browser;
    delete (globalThis as any).browser;
    (globalThis as any).chrome = {
      storage: { local: makeChromeArea() },
      runtime: { lastError: undefined },
    };

    const adapter = createStorageAdapter();
    expect(adapter).toBeInstanceOf(ChromeStorageAdapter);

    delete (globalThis as any).chrome;
    (globalThis as any).browser = origBrowser;
  });
});

// ─── StorageError ─────────────────────────────────────────────────────────────

describe('StorageError', () => {
  it('has correct name and code', () => {
    const err = new StorageError('test', StorageErrorCode.QUOTA_EXCEEDED);
    expect(err.name).toBe('StorageError');
    expect(err.code).toBe(StorageErrorCode.QUOTA_EXCEEDED);
    expect(err.message).toBe('test');
  });
});
