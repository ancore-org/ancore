import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LockManager } from '../lock-manager';

// ─── Mock SecureStorageManager ────────────────────────────────────────────────

function makeMockStorageManager(shouldFailUnlock = false) {
  return {
    unlock: vi.fn(async (password: string) => {
      if (shouldFailUnlock || password !== 'correct') {
        throw new Error('Invalid password or corrupted data');
      }
    }),
    lock: vi.fn(),
    isUnlocked: false,
    touch: vi.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LockManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in locked state', () => {
    const storage = makeMockStorageManager();
    const manager = new LockManager({ autoLockMinutes: 5, storageManager: storage as any });
    expect(manager.isLocked).toBe(true);
    manager.destroy();
  });

  it('unlocks with correct password', async () => {
    const storage = makeMockStorageManager();
    const onUnlock = vi.fn();
    const manager = new LockManager({
      autoLockMinutes: 5,
      storageManager: storage as any,
      onUnlock,
    });

    await manager.unlock('correct');

    expect(manager.isLocked).toBe(false);
    expect(onUnlock).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it('throws on incorrect password', async () => {
    const storage = makeMockStorageManager();
    const manager = new LockManager({ autoLockMinutes: 5, storageManager: storage as any });

    await expect(manager.unlock('wrong')).rejects.toThrow('Invalid password');
    expect(manager.isLocked).toBe(true);
    manager.destroy();
  });

  it('locks immediately when lock() is called', async () => {
    const storage = makeMockStorageManager();
    const onLock = vi.fn();
    const manager = new LockManager({
      autoLockMinutes: 5,
      storageManager: storage as any,
      onLock,
    });

    await manager.unlock('correct');
    expect(manager.isLocked).toBe(false);

    manager.lock();

    expect(manager.isLocked).toBe(true);
    expect(storage.lock).toHaveBeenCalledOnce();
    expect(onLock).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it('calls storageManager.lock() on lock to clear sensitive data', async () => {
    const storage = makeMockStorageManager();
    const manager = new LockManager({ autoLockMinutes: 1, storageManager: storage as any });

    await manager.unlock('correct');
    manager.lock();

    expect(storage.lock).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it('auto-locks after inactivity timeout', async () => {
    const storage = makeMockStorageManager();
    const onLock = vi.fn();
    const manager = new LockManager({
      autoLockMinutes: 1,
      storageManager: storage as any,
      onLock,
    });

    await manager.unlock('correct');
    expect(manager.isLocked).toBe(false);

    // Advance past the 1-minute timeout
    vi.advanceTimersByTime(61_000);

    expect(manager.isLocked).toBe(true);
    expect(onLock).toHaveBeenCalledOnce();
    manager.destroy();
  });

  it('does not auto-lock when autoLockMinutes is 0', async () => {
    const storage = makeMockStorageManager();
    const onLock = vi.fn();
    const manager = new LockManager({
      autoLockMinutes: 0,
      storageManager: storage as any,
      onLock,
    });

    await manager.unlock('correct');
    vi.advanceTimersByTime(999_999);

    expect(manager.isLocked).toBe(false);
    expect(onLock).not.toHaveBeenCalled();
    manager.destroy();
  });

  it('updates auto-lock timeout via setAutoLockMinutes', async () => {
    const storage = makeMockStorageManager();
    const onLock = vi.fn();
    const manager = new LockManager({
      autoLockMinutes: 5,
      storageManager: storage as any,
      onLock,
    });

    await manager.unlock('correct');

    // Shorten to 1 minute
    manager.setAutoLockMinutes(1);
    vi.advanceTimersByTime(61_000);

    expect(manager.isLocked).toBe(true);
    manager.destroy();
  });
});
