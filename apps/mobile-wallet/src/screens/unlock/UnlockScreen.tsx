import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BiometricLockoutManager } from '../../security/biometric-lockout-manager';
import { useBiometricUnlock } from '../../security/hooks/useBiometricUnlock';
import { AttemptsIndicator } from '../../components/AttemptsIndicator';
import { BiometricLockoutBanner } from '../../components/BiometricLockoutBanner';
import { PasswordFallbackForm } from '../../components/PasswordFallbackForm';
import type {
  IBiometricAuthService,
  IPasswordAuthService,
} from '../../security/hooks/useBiometricUnlock';
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
  const { state, attemptBiometric, switchToPasswordFallback, submitPassword, backToBiometric } =
    useBiometricUnlock({
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
  }, [state.isLoading, state.phase, state.isBiometricAvailable, attemptBiometric]);

  if (state.isLoading) {
    return (
      <View style={styles.container}>
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          Loading…
        </Text>
      </View>
    );
  }

  // Password fallback phase
  if (state.phase === 'fallback') {
    return (
      <View style={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>
          Enter your password
        </Text>
        <Text style={styles.body}>Use your wallet password to unlock your account.</Text>

        <PasswordFallbackForm
          onSubmit={submitPassword}
          isLoading={state.isLoading}
          error={state.passwordError}
        />

        {state.isBiometricAvailable &&
        !state.lockout.permanentlyLocked &&
        !lockoutManager.isLocked() ? (
          <Pressable accessibilityRole="button" onPress={backToBiometric} style={styles.link}>
            <Text style={styles.linkText}>Use biometric instead</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // Biometric / locked phase
  const isLocked = state.phase === 'locked';
  const showFeedback =
    !isLocked && Boolean(state.feedbackMessage) && state.lockout.failedAttempts === 0;

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Unlock Wallet
      </Text>
      <Text style={styles.body}>
        {state.isBiometricAvailable
          ? 'Verify your identity using biometrics.'
          : 'Use your password to access your wallet.'}
      </Text>

      {isLocked ? (
        <BiometricLockoutBanner
          isPermanent={state.lockout.permanentlyLocked}
          secondsRemaining={state.lockoutSecondsRemaining}
          message={state.feedbackMessage}
        />
      ) : null}

      {!isLocked && state.lockout.failedAttempts > 0 ? (
        <AttemptsIndicator
          attemptsRemaining={state.attemptsRemaining}
          maxAttempts={3}
          message={state.feedbackMessage}
        />
      ) : null}

      {showFeedback ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {state.feedbackMessage}
        </Text>
      ) : null}

      {!isLocked && state.isBiometricAvailable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: state.phase === 'prompting' }}
          disabled={state.phase === 'prompting'}
          onPress={attemptBiometric}
          style={[styles.button, state.phase === 'prompting' && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {state.phase === 'prompting' ? 'Waiting for biometric…' : 'Use Biometrics'}
          </Text>
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" onPress={switchToPasswordFallback} style={styles.link}>
        <Text style={styles.linkText}>
          {isLocked ? 'Use Password to Unlock' : 'Use Password Instead'}
        </Text>
      </Pressable>

      {state.lockout.permanentlyLocked ? (
        <Text style={styles.body}>
          Biometric authentication has been permanently disabled by your device. Contact support if
          you need further assistance.
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
  },
  body: {
    fontSize: 14,
    color: '#475569',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  link: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#3b82f6',
  },
});
