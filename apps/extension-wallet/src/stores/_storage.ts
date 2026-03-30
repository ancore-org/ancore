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
const chromeExtensionStorage: StateStorage = {
  getItem: (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(name, (result) => {
        resolve(result[name] ?? null);
      });
    });
  },

  setItem: (name: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [name]: value }, resolve);
    });
  },

  removeItem: (name: string): Promise<void> => {
    return new Promise((resolve) => {
      chrome.storage.local.remove(name, resolve);
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
