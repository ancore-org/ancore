/**
 * chrome.storage helpers shared by background handlers.
 */

type StorageGetCallback = (result: Record<string, unknown>) => void;
type StorageSetCallback = () => void;

type ChromeStorageLocal = {
  get: (key: string, callback: StorageGetCallback) => void;
  set: (items: Record<string, unknown>, callback?: StorageSetCallback) => void;
};

type ChromeStorageSession = {
  get: (key: string, callback: StorageGetCallback) => void;
  set: (items: Record<string, unknown>, callback?: StorageSetCallback) => void;
  remove: (key: string, callback?: StorageSetCallback) => void;
};

function getChromeStorageApi():
  | { local?: ChromeStorageLocal; session?: ChromeStorageSession }
  | undefined {
  return (
    globalThis as {
      chrome?: { storage?: { local?: ChromeStorageLocal; session?: ChromeStorageSession } };
    }
  ).chrome?.storage;
}

export function getChromeLocalStorage(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    const storage = getChromeStorageApi()?.local;
    if (storage) {
      storage.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    } else {
      resolve(localStorage.getItem(key));
    }
  });
}

export function setChromeLocalStorage(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    const storage = getChromeStorageApi()?.local;
    if (storage) {
      storage.set({ [key]: value }, resolve);
    } else {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      resolve();
    }
  });
}

export function getChromeSessionStorage(key: string): Promise<unknown> {
  return new Promise((resolve) => {
    const storage = getChromeStorageApi()?.session;
    if (storage) {
      storage.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    } else {
      resolve(null);
    }
  });
}

export function setChromeSessionStorage(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    const storage = getChromeStorageApi()?.session;
    if (storage) {
      storage.set({ [key]: value }, resolve);
    } else {
      resolve();
    }
  });
}

export function removeChromeSessionStorage(key: string): Promise<void> {
  return new Promise((resolve) => {
    const storage = getChromeStorageApi()?.session;
    if (storage) {
      storage.remove(key, resolve);
    } else {
      resolve();
    }
  });
}
