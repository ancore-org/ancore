import { useEffect, useRef } from 'react';
import { BiometricLockoutManager } from '../../security/biometric-lockout-manager';
import { useBiometricUnlock } from '../../security/hooks/useBiometricUnlock';
import { AttemptsIndicator } from '../../components/AttemptsIndicator';
import { BiometricLockoutBanner } from '../../components/BiometricLockoutBanner';
import { PasswordFallbackForm } from '../../components/PasswordFallbackForm';
import type { IBiometricAuthService, IPasswordAuthService } from '../../security/hooks/useBiometricUnlock';
import type { UnlockResult } from '../../security/biometric-lockout.types';

type Props = {
  lockoutManager: BiometricLockoutManager;
  biometricService: IBiometricAuthService;
  passwordService: IPasswordAuthService;
  onUnlocked: (result: UnlockResult) => void;
};

export const UnlockScreen = ({
  lockoutManager,
  biometricService,
  passwordService,
  onUnlocked,
}: Props) => {
  const hasAutoTriggered = useRef(false);
  const {
    state,
    attemptBiometric,
    switchToPasswordFallback,
    submitPassword,
    backToBiometric,
  } = useBiometricUnlock({
    lockoutManager,
    biometricService,
    passwordService,
    onSuccess: onUnlocked,
  });

  // Auto-trigger biometric prompt on mount
  useEffect(() => {
    if (
      !hasAutoTriggered.current &&
    !state.isLoading &&
    state.phase === 'idle' &&
    state.isBiometricAvailable
  ) {
    hasAutoTriggered.current = true;
      attemptBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isLoading, state.phase, state.isBiometricAvailable, attemptBiometric]);

  if (state.isLoading) {
    return <p aria-live="polite">Loading…</p>;
  }

  // Password fallback phase 
  if (state.phase === 'fallback') {
    return (
      <section>
        <h1>Enter your password</h1>
        <p>Use your wallet password to unlock your account.</p>

        <PasswordFallbackForm
          onSubmit={submitPassword}
          isLoading={state.isLoading}
          error={state.passwordError}
        />

        {state.isBiometricAvailable &&
          !state.lockout.permanentlyLocked &&
          !lockoutManager.isLocked() && (
            <button onClick={backToBiometric}>Use biometric instead</button>
          )}
      </section>
    );
  }

  // Biometric / locked phase
  const isLocked = state.phase === 'locked';

  return (
    <section>
      <h1>Unlock Wallet</h1>
      <p>
        {state.isBiometricAvailable
          ? 'Verify your identity using biometrics.'
          : 'Use your password to access your wallet.'}
      </p>

      {isLocked && (
        <BiometricLockoutBanner
          isPermanent={state.lockout.permanentlyLocked}
          secondsRemaining={state.lockoutSecondsRemaining}
          message={state.feedbackMessage}
        />
      )}

      {!isLocked && state.lockout.failedAttempts > 0 && (
        <AttemptsIndicator
          attemptsRemaining={state.attemptsRemaining}
          maxAttempts={3}
          message={state.feedbackMessage}
        />
      )}

      {!isLocked && state.feedbackMessage && state.lockout.failedAttempts === 0 && (
        <p aria-live="polite">{state.feedbackMessage}</p>
      )}

      {!isLocked && state.isBiometricAvailable && (
        <button onClick={attemptBiometric} disabled={state.phase === 'prompting'}>
          {state.phase === 'prompting' ? 'Waiting for biometric…' : 'Use Biometrics'}
        </button>
      )}

      <button onClick={switchToPasswordFallback}>
        {isLocked ? 'Use Password to Unlock' : 'Use Password Instead'}
      </button>

      {state.lockout.permanentlyLocked && (
        <p>
          Biometric authentication has been permanently disabled by your device.
          Contact support if you need further assistance.
        </p>
      )}
    </section>
  );
};