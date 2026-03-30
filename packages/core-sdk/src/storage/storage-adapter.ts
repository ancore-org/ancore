/**
 * Storage Adapter
 *
 * Implements the StorageAdapter interface for Chrome and Firefox extension storage.
 * Normalizes async behavior and serialization, handles quota limits and typed errors.
 */

import { StorageAdapter } from './types';

// ─── Typed Errors ────────────────────────────────────────────────────────────

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export enum StorageErrorCode {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NOT_FOUND = 'NOT_FOUND',
  SERIALIZATION = 'SERIALIZATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN = 'UNKNOWN',
}

function mapToStorageError(err: unknown): StorageError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes('quota') || lower.includes('storage full') || lower.includes('exceeded')) {
    return new StorageError(message, StorageErrorCode.QUOTA_EXCEEDED);
  }
  if (lower.includes('permission') || lower.includes('access denied')) {
    return new StorageError(message, StorageErrorCode.PERMISSION_DENIED);
  }
  if (lower.includes('json') || lower.includes('parse') || lower.includes('serializ')) {
    return new StorageError(message, StorageErrorCode.SERIALIZATION);
  }

  return new StorageError(message, StorageErrorCode.UNKNOWN);
}

// ─── Chrome Storage Adapter ──────────────────────────────────────────────────

/**
 * Adapter for chrome.storage.local (Manifest V3 compatible).
 */
export class ChromeStorageAdapter implements StorageAdapter {
  private readonly area: chrome.storage.StorageArea;

  constructor(area: chrome.storage.StorageArea = chrome.storage.local) {
    this.area = area;
  }

  async get(key: string): Promise<unknown> {
    try {
      return await new Promise((resolve, reject) => {
        this.area.get(key, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(result[key] ?? null);
        });
      });
    } catch (err) {
      throw mapToStorageError(err);
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.area.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
    } catch (err) {
      throw mapToStorageError(err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.area.remove(key, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
    } catch (err) {
      throw mapToStorageError(err);
    }
  }

  /** Returns bytes used and quota (if available). */
  async getQuotaInfo(): Promise<{ bytesUsed: number; quotaBytes: number | null }> {
    return new Promise((resolve, reject) => {
      this.area.getBytesInUse(null, (bytesUsed) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        // chrome.storage.local.QUOTA_BYTES is ~5MB; sync is ~100KB
        const quotaBytes =
          'QUOTA_BYTES' in this.area ? (this.area as { QUOTA_BYTES: number }).QUOTA_BYTES : null;
        resolve({ bytesUsed, quotaBytes });
      });
    });
  }
}

// ─── Browser (WebExtension Polyfill) Storage Adapter ─────────────────────────

/**
 * Adapter for browser.storage.local (Firefox / webextension-polyfill).
 * The polyfill already returns Promises, so no callback wrapping needed.
 */
export class BrowserStorageAdapter implements StorageAdapter {
  private readonly area: browser.storage.StorageArea;

  constructor(area?: browser.storage.StorageArea) {
    this.area = area ?? browser.storage.local;
  }

  async get(key: string): Promise<unknown> {
    try {
      const result = await this.area.get(key);
      return result[key] ?? null;
    } catch (err) {
      throw mapToStorageError(err);
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      await this.area.set({ [key]: value });
    } catch (err) {
      throw mapToStorageError(err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.area.remove(key);
    } catch (err) {
      throw mapToStorageError(err);
    }
  }
}

// ─── Runtime Detection ────────────────────────────────────────────────────────

/**
 * Detects the current browser runtime and returns the appropriate adapter.
 * Falls back to a localStorage-based adapter for non-extension environments (tests/dev).
 */
export function createStorageAdapter(): StorageAdapter {
  // Firefox with webextension-polyfill
  if (typeof browser !== 'undefined' && browser?.storage?.local) {
    return new BrowserStorageAdapter();
  }

  // Chrome / Chromium-based
  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    return new ChromeStorageAdapter();
  }

  // Fallback: localStorage (dev / test environments)
  return new LocalStorageAdapter();
}

// ─── LocalStorage Fallback (dev/test) ────────────────────────────────────────

export class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<unknown> {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : null;
    } catch (err) {
      throw mapToStorageError(err);
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      throw mapToStorageError(err);
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
