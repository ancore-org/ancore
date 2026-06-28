import { SecureStoreAdapter } from './types';

export class MemorySecureStoreAdapter implements SecureStoreAdapter {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async remove(key: string): Promise<void> {
    await this.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
