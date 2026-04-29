
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BIOMETRIC_MAX_ATTEMPTS,
  type BiometricFailureReason,
  type BiometricLockoutState,
  type UnlockResult,
} from '../biometric-lockout.types';
import { BiometricLockoutManager } from '../biometric-lockout-manager';

//  Platform abstraction 
export interface IBiometricAuthService {
  isAvailable(): Promise<boolean>;
  authenticate(promptMessage: string): Promise<{
    success: boolean;
    error?: string;
    errorCode?: BiometricFailureReason;
  }>;
}

export interface IPasswordAuthService {
  authenticate(password: string): Promise<boolean>;
}

// Hook config 
export interface UseBiometricUnlockOptions {
  lockoutManager: BiometricLockoutManager;
  biometricService: IBiometricAuthService;
  passwordService: IPasswordAuthService;
  promptMessage?: string;
  onSuccess?: (result: UnlockResult) => void;
  onPermanentLockout?: () => void;
}

// Hook state shape 
export interface BiometricUnlockState {
  phase: 'idle' | 'prompting' | 'locked' | 'fallback' | 'success' | 'error';
  lockout: BiometricLockoutState;
  attemptsRemaining: number;
  lockoutSecondsRemaining: number;
  isBiometricAvailable: boolean;
  isLoading: boolean;
  feedbackMessage: string | null;
  passwordError: string | null;
}

// Hook

export function useBiometricUnlock({
  lockoutManager,
  biometricService,
  passwordService,
  promptMessage = 'Verify your identity to unlock your wallet',
  onSuccess,
  onPermanentLockout,
}: UseBiometricUnlockOptions) {
  const [state, setState] = useState<BiometricUnlockState>({
    phase: 'idle',
    lockout: lockoutManager.getState() as BiometricLockoutState,
    attemptsRemaining: BIOMETRIC_MAX_ATTEMPTS,
    lockoutSecondsRemaining: 0,
    isBiometricAvailable: false,
    isLoading: true,
    feedbackMessage: null,
    passwordError: null,
  });

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopCountdown = useCallback(() => {
 if (countdownRef.current) {
   clearInterval(countdownRef.current);
   countdownRef.current = null;
 }
 }, []);

  //Init 
  useEffect(() => {
    let cancelled = false;

    async function init() {
      await lockoutManager.initialize();
      const available = await biometricService.isAvailable();
      const isLocked = lockoutManager.isLocked();
      const lockout = lockoutManager.getState() as BiometricLockoutState;


      if (!cancelled) {
        setState(prev => ({
          ...prev,
          isBiometricAvailable: available,
          lockout,
          attemptsRemaining: Math.max(0, BIOMETRIC_MAX_ATTEMPTS - lockout.failedAttempts),
          phase: isLocked ? 'locked' : 'idle',
          isLoading: false,
        }));

        if (isLocked) startCountdown();
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //Countdown timer 
  function startCountdown() {
    stopCountdown();

    countdownRef.current = setInterval(() => {
      const remaining = lockoutManager.remainingLockoutMs();

      if (remaining <= 0) {
        stopCountdown();
        lockoutManager.isLocked(); // trigger lazy expiry/reset if implemented there
        const refreshedLockout = lockoutManager.getState() as BiometricLockoutState;
        // Lockout expired — allow retry
        setState(prev => ({
          ...(prev.phase !== 'locked' ? prev : {
          ...prev,
          phase: 'idle',
          lockoutSecondsRemaining: 0,
          lockout: refreshedLockout,
          attemptsRemaining: Math.max(0,
            BIOMETRIC_MAX_ATTEMPTS - refreshedLockout.failedAttempts,
          ),
          feedbackMessage: 'You can try again now.',
           }),
        }));
      } else {
        setState(prev => ({
          ...prev,
          lockoutSecondsRemaining: Math.ceil(remaining / 1000),
        }));
      }
    }, 500);
  }

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ─── Biometric attempt ────────────────────────────────────────────────────────

  const attemptBiometric = useCallback(async () => {
    if (lockoutManager.isLocked()) return;

    setState(prev => ({ ...prev, phase: 'prompting', isLoading: true, feedbackMessage: null }));

    let result;
    try {
      result = await biometricService.authenticate(promptMessage);
    } catch {
      setState(prev => ({
        ...prev,
        phase: 'idle',
        isLoading: false,
        feedbackMessage: 'Biometric authentication failed. Please try again or use your password.',
      }));
      return;
    }

    if (result.success) {
      await lockoutManager.recordSuccess();
      setState(prev => ({
        ...prev,
        phase: 'success',
        isLoading: false,
        feedbackMessage: 'Identity verified.',
      }));
      onSuccess?.({ success: true, method: 'biometric' });
      return;
    }

    // Map error code
    const reason: BiometricFailureReason = result.errorCode ?? 'UNKNOWN';
    const newLockout = await lockoutManager.recordFailure(reason);
    const isNowLocked = lockoutManager.isLocked();

    if (newLockout.permanentlyLocked) {
      setState(prev => ({
        ...prev,
        phase: 'locked',
        lockout: newLockout,
        isLoading: false,
        feedbackMessage: buildFeedbackMessage(reason, newLockout, 0),
      }));
      onPermanentLockout?.();
      return;
    }

    if (isNowLocked) {
      startCountdown();
      const secsRemaining = Math.ceil(lockoutManager.remainingLockoutMs() / 1000);
      setState(prev => ({
        ...prev,
        phase: 'locked',
        lockout: newLockout,
        attemptsRemaining: 0,
        lockoutSecondsRemaining: secsRemaining,
        isLoading: false,
        feedbackMessage: buildFeedbackMessage(reason, newLockout, secsRemaining),
      }));
      return;
    }

    const attemptsRemaining = Math.max(0, BIOMETRIC_MAX_ATTEMPTS - newLockout.failedAttempts);
    setState(prev => ({
      ...prev,
      phase: 'idle',
      lockout: newLockout,
      attemptsRemaining,
      isLoading: false,
      feedbackMessage: buildFeedbackMessage(reason, newLockout, 0),
    }));
  }, [biometricService, lockoutManager, onSuccess, onPermanentLockout, promptMessage]);

  // Password fallback 
  const switchToPasswordFallback = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'fallback',
      feedbackMessage: null,
      passwordError: null,
    }));
  }, []);

  const submitPassword = useCallback(async (password: string) => {
    setState(prev => ({ ...prev, isLoading: true, passwordError: null }));

    let ok = false;
    try {
      ok = await passwordService.authenticate(password);
    } catch {
      setState(prev => ({
        ...prev,
        isLoading: false,
        passwordError: 'Unable to verify password right now. Please try again.',
      }));
      return;
    }
    if (ok) {
      stopCountdown();
      await lockoutManager.recordSuccess();
      setState(prev => ({
        ...prev,
        phase: 'success',
        isLoading: false,
        feedbackMessage: 'Access granted.',
      }));
      onSuccess?.({ success: true, method: 'password' });
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        passwordError: 'Incorrect password. Please try again.',
      }));
    }
  }, [lockoutManager, onSuccess, passwordService]);

  const backToBiometric = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: lockoutManager.isLocked() ? 'locked' : 'idle',
      passwordError: null,
    }));
  }, [lockoutManager]);

  return {
    state,
    attemptBiometric,
    switchToPasswordFallback,
    submitPassword,
    backToBiometric,
  };
}

//Feedback message builder 
function buildFeedbackMessage(
  reason: BiometricFailureReason,
  lockout: BiometricLockoutState,
  secsRemaining: number,
): string {
  if (lockout.permanentlyLocked) {
    return 'Biometric authentication has been permanently disabled by your device. Use your password to unlock.';
  }

  if (lockout.lockedUntil !== null && secsRemaining > 0) {
    return `Too many failed attempts. Try again in ${secsRemaining} second${secsRemaining === 1 ? '' : 's'}, or use your password.`;
  }

  const remaining = Math.max(0, BIOMETRIC_MAX_ATTEMPTS - lockout.failedAttempts);

  switch (reason) {
    case 'AUTHENTICATION_FAILED':
      return remaining === 1
        ? `Fingerprint not recognised. 1 attempt remaining before temporary lockout.`
        : `Fingerprint not recognised. ${remaining} attempts remaining.`;
    case 'BIOMETRIC_NOT_ENROLLED':
      return 'No biometrics enrolled on this device. Please use your password.';
    case 'BIOMETRIC_NOT_AVAILABLE':
      return 'Biometric hardware is unavailable. Please use your password.';
    case 'USER_CANCEL':
      return 'Authentication cancelled.';
    default:
      return 'Biometric authentication failed. Please try again or use your password.';
  }
}