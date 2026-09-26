/**
 * Extension Storage for Zustand Persist
 *
 * Wraps chrome.storage.local / browser.storage.local (via webextension-polyfill)
 * into the StateStorage interface that Zustand's createJSONStorage expects.
 * Falls back to localStorage in dev/test environments.
 */

import type { StateStorage } from 'zustand/middleware';

function isChromeExtension(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.storage !== 'undefined' &&
    typeof chrome.storage.local !== 'undefined'
  );
}

function isBrowserExtension(): boolean {
  return (
    typeof browser !== 'undefined' &&
    typeof browser.storage !== 'undefined' &&
    typeof browser.storage.local !== 'undefined'
  );
}

/**
 * Async storage backed by chrome.storage.local or browser.storage.local.
 * Zustand's createJSONStorage accepts async getItem/setItem/removeItem.
 */
/**
 * Read and clear chrome.runtime.lastError, returning it as an Error.
 *
 * chrome.storage reports failures (quota exceeded, extension context
 * invalidated, serialization failure) only through chrome.runtime.lastError
 * inside the callback — it never throws. The property must always be accessed
 * in the callback to avoid "Unchecked runtime.lastError" console warnings.
 */
function takeRuntimeError(operation: string): Error | null {
  const runtimeError = chrome.runtime?.lastError;
  if (!runtimeError) return null;
  return new Error(runtimeError.message ?? `[storage] Unknown runtime error during ${operation}`);
}

const chromeExtensionStorage: StateStorage = {
  getItem: (name: string): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(name, (result: Record<string, unknown>) => {
        const error = takeRuntimeError(`getItem('${name}')`);
        if (error) {
          reject(error);
          return;
        }

        const value = result?.[name];
        resolve(typeof value === 'string' ? value : null);
      });
    });
  },

  setItem: (name: string, value: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [name]: value }, () => {
        const error = takeRuntimeError(`setItem('${name}')`);
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  },

  removeItem: (name: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(name, () => {
        const error = takeRuntimeError(`removeItem('${name}')`);
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  },
};

const browserExtensionStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const result = await browser.storage.local.get(name);
    return (result[name] as string) ?? null;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    await browser.storage.local.set({ [name]: value });
  },

  removeItem: async (name: string): Promise<void> => {
    await browser.storage.local.remove(name);
  },
};

const localStorageFallback: StateStorage = {
  getItem: (name) => Promise.resolve(localStorage.getItem(name)),
  setItem: (name, value) => {
    localStorage.setItem(name, value);
    return Promise.resolve();
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    return Promise.resolve();
  },
};

export const extensionStorage: StateStorage = isBrowserExtension()
  ? browserExtensionStorage
  : isChromeExtension()
    ? chromeExtensionStorage
    : localStorageFallback;
