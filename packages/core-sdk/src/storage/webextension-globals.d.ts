declare namespace chrome {
  namespace runtime {
    const lastError: { message: string } | undefined;
  }

  namespace storage {
    interface StorageArea {
      get(key: string, callback: (result: Record<string, unknown>) => void): void;
      set(items: Record<string, unknown>, callback: () => void): void;
      remove(key: string, callback: () => void): void;
      getBytesInUse(keys: string | string[] | null, callback: (bytesInUse: number) => void): void;
      QUOTA_BYTES?: number;
    }

    const local: StorageArea;
  }
}

declare namespace browser {
  namespace storage {
    interface StorageArea {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    }

    const local: StorageArea;
  }
}
