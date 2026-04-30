
import {
  BIOMETRIC_MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  LOCKOUT_STORAGE_KEY,
  DEFAULT_LOCKOUT_STATE,
  type BiometricFailureReason,
  type BiometricLockoutState,
} from './biometric-lockout.types';

export interface ISecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class BiometricLockoutManager {
  private state: BiometricLockoutState = { ...DEFAULT_LOCKOUT_STATE };
  private storage: ISecureStorage;

  constructor(storage: ISecureStorage) {
    this.storage = storage;
  }

  // Lifecycle
  async initialize(): Promise<void> {
    const raw = await this.storage.getItem(LOCKOUT_STORAGE_KEY);
    if (raw) {
      try {
        const persisted: BiometricLockoutState = JSON.parse(raw);
        // Basic shape validation
      if (
        typeof persisted.failedAttempts !== 'number' ||
        typeof persisted.permanentlyLocked !== 'boolean' ||
        (persisted.lockedUntil !== null && typeof persisted.lockedUntil !== 'number')
      ) {
         throw new Error('Invalid state shape');
       }
        this.state = persisted;
        // Auto-clear expired time-based lockout on load
        if (this.isTimedLockoutExpired()) {
          await this.clearTimedLockout();
        }
      } catch {
        // Corrupt state: reset to safe default
        await this.reset();
      }
    }
  }

  // State Accessors 
  getState(): Readonly<BiometricLockoutState> {
    return { ...this.state };
  }

  isLocked(): boolean {
    if (this.state.permanentlyLocked) return true;
    if (this.state.lockedUntil !== null) {
      if (Date.now() < this.state.lockedUntil) return true;
      // Expired; will be cleared lazily
    }
    return false;
  }

  remainingLockoutMs(): number {
    if (!this.state.lockedUntil) return 0;
    return Math.max(0, this.state.lockedUntil - Date.now());
  }

  isPermanentlyLocked(): boolean {
    return this.state.permanentlyLocked;
  }

  // Failure Recording 
  async recordFailure(reason: BiometricFailureReason): Promise<BiometricLockoutState> {
    if (reason === 'LOCKOUT_PERMANENT') {
      return this.setPermanentLockout(reason);
    }

    if (reason === 'LOCKOUT') {
      // OS-level temporary lockout — align our state with it
      return this.setTimedLockout(reason);
    }

    if (reason === 'USER_CANCEL') {
      // User-initiated cancel: do not count as a failure attempt
      return this.getState() as BiometricLockoutState;
    }

    // Genuine authentication failure
    this.state = {
      ...this.state,
      failedAttempts: this.state.failedAttempts + 1,
      lastFailureReason: reason,
    };

    if (this.state.failedAttempts >= BIOMETRIC_MAX_ATTEMPTS) {
      return this.setTimedLockout(reason);
    }

    await this.persist();
    return this.getState() as BiometricLockoutState;
  }

  // Success Handling 

  
  async recordSuccess(): Promise<void> {
    await this.reset();
  }

  // Reset / Clear
  async reset(): Promise<void> {
    this.state = { ...DEFAULT_LOCKOUT_STATE };
    await this.storage.removeItem(LOCKOUT_STORAGE_KEY);
  }

  // Private Helpers 
  private async setTimedLockout(reason: BiometricFailureReason): Promise<BiometricLockoutState> {
    this.state = {
      ...this.state,
      lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
      lastFailureReason: reason,
    };
    await this.persist();
    return this.getState() as BiometricLockoutState;
  }

  private async setPermanentLockout(reason: BiometricFailureReason): Promise<BiometricLockoutState> {
    this.state = {
      ...this.state,
      permanentlyLocked: true,
      lockedUntil: null,
      lastFailureReason: reason,
    };
    await this.persist();
    return this.getState() as BiometricLockoutState;
  }

  private async clearTimedLockout(): Promise<void> {
    this.state = {
      ...this.state,
      failedAttempts: 0,
      lockedUntil: null,
      lastFailureReason: null,
    };
    await this.persist();
  }

  private isTimedLockoutExpired(): boolean {
    return (
      this.state.lockedUntil !== null &&
      !this.state.permanentlyLocked &&
      Date.now() >= this.state.lockedUntil
    );
  }

  private async persist(): Promise<void> {
    await this.storage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(this.state));
  }
}