import type { StorageAdapter } from '../types';
import { normalizeStorageAdapter, tryParseStructuredJson } from '../secure-storage-manager';

class MockStorageAdapter implements StorageAdapter {
  readonly store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('tryParseStructuredJson', () => {
  it.each(['true', 'false', 'null', '1e3', '123', '12ab', 'hello', '"quoted"'])(
    'does not treat scalar-like string %j as structured JSON',
    (value) => {
      expect(tryParseStructuredJson(value)).toBeUndefined();
    }
  );

  it('parses object and array containers', () => {
    expect(tryParseStructuredJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseStructuredJson('[1,2]')).toEqual([1, 2]);
    expect(tryParseStructuredJson('  {"nested":true}')).toEqual({ nested: true });
  });

  it('returns undefined for malformed container-shaped strings', () => {
    expect(tryParseStructuredJson('{')).toBeUndefined();
    expect(tryParseStructuredJson('[1,')).toBeUndefined();
  });
});

describe('normalizeStorageAdapter round-trip', () => {
  let legacy: MockStorageAdapter;
  let platform: ReturnType<typeof normalizeStorageAdapter>;

  beforeEach(() => {
    legacy = new MockStorageAdapter();
    platform = normalizeStorageAdapter(legacy);
  });

  it.each(['true', 'null', '1e3', '12ab'])(
    'round-trips string value %j byte-identical and stores a string',
    async (value) => {
      await platform.set('k', value);

      expect(legacy.store.get('k')).toBe(value);
      expect(typeof legacy.store.get('k')).toBe('string');
      expect(await platform.get('k')).toBe(value);
    }
  );

  it('stores JSON object strings as objects in the legacy store', async () => {
    await platform.set('obj', '{"salt":"a","iv":"b","data":"c"}');

    expect(legacy.store.get('obj')).toEqual({ salt: 'a', iv: 'b', data: 'c' });
    expect(await platform.get('obj')).toBe('{"salt":"a","iv":"b","data":"c"}');
  });

  it('stores JSON array strings as arrays in the legacy store', async () => {
    await platform.set('arr', '[1,2,3]');

    expect(legacy.store.get('arr')).toEqual([1, 2, 3]);
    expect(await platform.get('arr')).toBe('[1,2,3]');
  });

  it('reads legacy bare objects without an envelope', async () => {
    await legacy.set('legacy', { salt: 'x', iv: 'y', data: 'z' });

    expect(await platform.get('legacy')).toBe('{"salt":"x","iv":"y","data":"z"}');
  });

  it('passes through a PlatformStorageAdapter unchanged', () => {
    const platformOnly = {
      get: async () => null,
      set: async () => undefined,
      delete: async () => undefined,
    };

    expect(normalizeStorageAdapter(platformOnly)).toBe(platformOnly);
  });
});
