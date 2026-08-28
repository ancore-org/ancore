/**
 * Ambient declaration for Firefox's `browser` WebExtension global.
 *
 * `@types/webextension-polyfill` only declares the `webextension-polyfill`
 * *module* — it never declares the global. This is the single canonical
 * declaration for the monorepo; it is pulled into every consumer's program by
 * the `/// <reference path>` in `storage/storage-adapter.ts`, so apps must not
 * each declare their own copy (duplicate globals collide).
 *
 * Deliberately minimal: it covers only the surface the wallet actually uses.
 */

declare namespace browser {
  namespace storage {
    interface StorageArea {
      get(
        keys?: string | string[] | Record<string, unknown> | null
      ): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    const local: StorageArea;
    const sync: StorageArea;
    const session: StorageArea;
  }
}
