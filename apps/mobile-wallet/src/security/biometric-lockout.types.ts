
export const BIOMETRIC_MAX_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 30_000; // 30 seconds
export const LOCKOUT_STORAGE_KEY = 'biometric_lockout_state';

export type BiometricFailureReason =
  | 'USER_CANCEL'
  | 'AUTHENTICATION_FAILED'
  | 'BIOMETRIC_NOT_ENROLLED'
  | 'BIOMETRIC_NOT_AVAILABLE'
  | 'LOCKOUT'
  | 'LOCKOUT_PERMANENT'
  | 'UNKNOWN';

export type UnlockMethod = 'biometric' | 'password' | 'none';

export interface BiometricLockoutState {
  failedAttempts: number;
  lockedUntil: number | null; // epoch ms, null = not locked
  lastFailureReason: BiometricFailureReason | null;
  permanentlyLocked: boolean;
}

export interface UnlockResult {
  success: boolean;
  method: UnlockMethod;
  error?: BiometricFailureReason;
}

export const DEFAULT_LOCKOUT_STATE: BiometricLockoutState = {
  failedAttempts: 0,
  lockedUntil: null,
  lastFailureReason: null,
  permanentlyLocked: false,
};