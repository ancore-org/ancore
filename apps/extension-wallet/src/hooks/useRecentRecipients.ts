import { useCallback, useEffect, useRef, useState } from 'react';
import { ChromeStorageAdapter, SecureStorageManager, type RecentRecipient } from '@ancore/core-sdk';

let _storageManager: InstanceType<typeof SecureStorageManager> | null = null;

function getStorageManager() {
  if (!_storageManager) {
    _storageManager = new SecureStorageManager(new ChromeStorageAdapter());
  }
  return _storageManager;
}

export function useRecentRecipients() {
  const [recipients, setRecipients] = useState<RecentRecipient[]>([]);
  const recipientsRef = useRef<RecentRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const manager = getStorageManager();
    if (!manager.isUnlocked) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await manager.getRecentRecipients();
      const loaded = data?.recipients || [];
      recipientsRef.current = loaded;
      setRecipients(loaded);
    } catch (err) {
      console.error('Failed to load recent recipients', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addRecipient = useCallback(async (recipient: Omit<RecentRecipient, 'timestamp'>) => {
    const manager = getStorageManager();
    if (!manager.isUnlocked) return;

    const current = recipientsRef.current;

    // Remove if already exists (to move it to top)
    const filtered = current.filter(
      (r) => r.address.toLowerCase() !== recipient.address.toLowerCase()
    );

    const newItem: RecentRecipient = {
      ...recipient,
      timestamp: Date.now(),
    };

    const updated = [newItem, ...filtered].slice(0, 5);

    await manager.saveRecentRecipients({ recipients: updated });
    recipientsRef.current = updated;
    setRecipients(updated);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { recipients, addRecipient, isLoading };
}
