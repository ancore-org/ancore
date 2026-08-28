/**
 * Type-safe chrome extension API wrapper.
 *
 * Centralises all access to the chrome global so no handler ever needs an
 * `as any` cast.  Each accessor returns `undefined` gracefully when the
 * extension API is unavailable (e.g. unit-test environments).
 *
 * Issue #1027
 */

// ---------------------------------------------------------------------------
// Internal typed shape of the chrome global we actually use
// ---------------------------------------------------------------------------

type StorageGetCallback = (result: Record<string, unknown>) => void;
type StorageSetCallback = () => void;
type StorageRemoveCallback = () => void;

interface ChromeStorageArea {
  get(key: string, callback: StorageGetCallback): void;
  set(items: Record<string, unknown>, callback?: StorageSetCallback): void;
  remove?(key: string, callback?: StorageRemoveCallback): void;
}

interface ChromeStorage {
  local?: ChromeStorageArea;
  session?: ChromeStorageArea & { remove(key: string, callback?: StorageRemoveCallback): void };
}

interface ChromeRuntimeSendMessageCallback {
  (response: unknown): void;
}

interface ChromeRuntime {
  sendMessage(message: unknown, callback?: ChromeRuntimeSendMessageCallback): void;
  lastError?: { message?: string } | null;
}

interface ChromeApi {
  storage?: ChromeStorage;
  runtime?: ChromeRuntime;
}

// ---------------------------------------------------------------------------
// Root accessor — the single place that touches globalThis
// ---------------------------------------------------------------------------

function getChromeApi(): ChromeApi | undefined {
  return (globalThis as { chrome?: ChromeApi }).chrome;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

/** Returns `chrome.storage.local`, or `undefined` outside the extension. */
export function getChromeLocalStorageArea(): ChromeStorageArea | undefined {
  return getChromeApi()?.storage?.local;
}

/** Returns `chrome.storage.session`, or `undefined` outside the extension. */
export function getChromeSessionStorageArea():
  | (ChromeStorageArea & {
      remove(key: string, callback?: StorageRemoveCallback): void;
    })
  | undefined {
  return getChromeApi()?.storage?.session;
}

/** Returns `chrome.runtime`, or `undefined` outside the extension. */
export function getChromeRuntime(): ChromeRuntime | undefined {
  return getChromeApi()?.runtime;
}

// ---------------------------------------------------------------------------
// Promise-based convenience wrappers
// ---------------------------------------------------------------------------

export function readChromeLocal(key: string): Promise<string | null> {
  const local = getChromeLocalStorageArea();
  if (local) {
    return new Promise((resolve) => {
      local.get(key, (result) => {
        const value = result[key];
        resolve(typeof value === 'string' ? value : null);
      });
    });
  }
  return Promise.resolve(localStorage.getItem(key));
}

export function writeChromeLocal(key: string, value: unknown): Promise<void> {
  const local = getChromeLocalStorageArea();
  if (local) {
    return new Promise((resolve) => {
      local.set({ [key]: value }, resolve);
    });
  }
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  return Promise.resolve();
}

export function sendChromeMessage(message: unknown): Promise<unknown> {
  const runtime = getChromeRuntime();
  if (!runtime?.sendMessage) {
    return Promise.reject(new Error('Chrome runtime not available'));
  }
  return new Promise((resolve, reject) => {
    runtime.sendMessage(message, (response) => {
      if (runtime.lastError) {
        reject(new Error(runtime.lastError.message ?? 'Chrome runtime error'));
        return;
      }
      resolve(response);
    });
  });
}
