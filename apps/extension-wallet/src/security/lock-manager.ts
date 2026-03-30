/**
 * Lock Manager
 *
 * Manages wallet lock/unlock state. Integrates with InactivityDetector
 * for auto-lock and verifies password via SecureStorageManager.
 */

import { SecureStorageManager } from '@ancore/core-sdk';
import { InactivityDetector } from './inactivity-detector';

export type LockStatus = 'locked' | 'unlocked';

export interface LockManagerOptions {
  /** Auto-lock timeout in minutes. 0 = never. */
  autoLockMinutes: number;
  storageManager: SecureStorageManager;
  onLock?: () => void;
  onUnlock?: () => void;
}

export class LockManager {
  private status: LockStatus = 'locked';
  private readonly storageManager: SecureStorageManager;
  private readonly detector: InactivityDetector;
  private readonly onLock?: () => void;
  private readonly onUnlock?: () => void;

  constructor(options: LockManagerOptions) {
    this.storageManager = options.storageManager;
    this.onLock = options.onLock;
    this.onUnlock = options.onUnlock;

    this.detector = new InactivityDetector(() => this.lock(), options.autoLockMinutes * 60 * 1000);
  }

  get isLocked(): boolean {
    return this.status === 'locked';
  }

  /**
   * Unlock the wallet with the given password.
   * Throws if the password is incorrect.
   */
  async unlock(password: string): Promise<void> {
    // Delegates password verification to SecureStorageManager.
    // unlock() will throw 'Invalid password or corrupted data' on bad password.
    await this.storageManager.unlock(password);

    this.status = 'unlocked';
    this.detector.start();
    this.onUnlock?.();
  }

  /**
   * Lock the wallet immediately, clearing sensitive data from memory.
   */
  lock(): void {
    this.storageManager.lock();
    this.status = 'locked';
    this.detector.stop();
    this.onLock?.();
  }

  /**
   * Update the auto-lock timeout (e.g. when user changes settings).
   */
  setAutoLockMinutes(minutes: number): void {
    this.detector.setTimeoutMs(minutes * 60 * 1000);
  }

  /**
   * Signal user activity to reset the inactivity timer.
   */
  touch(): void {
    this.detector.touch();
  }

  destroy(): void {
    this.detector.destroy();
  }
}
