import { StorageAdapter } from '../types';
import {
  LocalStorageAdapter,
  ChromeStorageAdapter,
  BrowserStorageAdapter,
} from '../storage-adapter';

// ─── LocalStorage shim ────────────────────────────────────────────────────────

function makeMemoryLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  } as Storage;
}

// ─── Chrome area shim ─────────────────────────────────────────────────────────

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
    getBytesInUse: jest.fn((_: null, cb: (n: number) => void) => cb(0)),
    QUOTA_BYTES: 5242880,
  };
}

// ─── Browser area shim ────────────────────────────────────────────────────────

function makeBrowserArea(store: Record<string, unknown> = {}) {
  return {
    get: jest.fn(async (key: string) => ({ [key]: store[key] })),
    set: jest.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
}

// ─── Adapter factories ────────────────────────────────────────────────────────

type AdapterFactory = () => StorageAdapter;

const adapters: [string, AdapterFactory][] = [
  [
    'LocalStorageAdapter',
    () => {
      (globalThis as any).localStorage = makeMemoryLocalStorage();
      return new LocalStorageAdapter();
    },
  ],
  [
    'ChromeStorageAdapter',
    () => {
      const area = makeChromeArea();
      (globalThis as any).chrome = { runtime: { lastError: undefined } };
      return new ChromeStorageAdapter(area as any);
    },
  ],
  [
    'BrowserStorageAdapter',
    () => new BrowserStorageAdapter(makeBrowserArea() as any),
  ],
];

// ─── Conformance suite ────────────────────────────────────────────────────────

describe.each(adapters)('StorageAdapter conformance — %s', (_name, factory) => {
  let adapter: StorageAdapter;

  beforeEach(() => {
    adapter = factory();
  });

  test('get returns null for a missing key', async () => {
    expect(await adapter.get('nonexistent')).toBeNull();
  });

  test('set and get roundtrip', async () => {
    await adapter.set('key', { value: 42 });
    expect(await adapter.get('key')).toEqual({ value: 42 });
  });

  test('set overwrites an existing key', async () => {
    await adapter.set('key', 'first');
    await adapter.set('key', 'second');
    expect(await adapter.get('key')).toBe('second');
  });

  test('remove deletes a key', async () => {
    await adapter.set('key', 'data');
    await adapter.remove('key');
    expect(await adapter.get('key')).toBeNull();
  });

  test('remove on a missing key does not throw', async () => {
    await expect(adapter.remove('never-set')).resolves.toBeUndefined();
  });

  test('stores string values', async () => {
    await adapter.set('str', 'hello');
    expect(await adapter.get('str')).toBe('hello');
  });

  test('stores numeric values', async () => {
    await adapter.set('num', 99);
    expect(await adapter.get('num')).toBe(99);
  });

  test('stores boolean values', async () => {
    await adapter.set('bool', false);
    expect(await adapter.get('bool')).toBe(false);
  });

  test('stores nested objects', async () => {
    const obj = { a: { b: { c: [1, 2, 3] } } };
    await adapter.set('nested', obj);
    expect(await adapter.get('nested')).toEqual(obj);
  });

  test('keys are isolated from each other', async () => {
    await adapter.set('a', 1);
    await adapter.set('b', 2);
    expect(await adapter.get('a')).toBe(1);
    expect(await adapter.get('b')).toBe(2);
  });
});
