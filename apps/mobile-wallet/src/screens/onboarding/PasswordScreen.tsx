import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { validatePasswordStrength } from '@ancore/crypto';

type Props = {
  flow: 'create' | 'import';
  onBack?: () => void;
  onCancel?: () => void;
  onComplete?: (password: string) => Promise<void> | void;
};

const noop = () => {};

const STRENGTH_COLORS: Record<string, string> = {
  weak: '#ef4444',
  medium: '#eab308',
  strong: '#22c55e',
};

const STRENGTH_LABELS: Record<string, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
};

export function PasswordScreen({ flow, onBack = noop, onCancel = noop, onComplete = noop }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordResult = validatePasswordStrength(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canContinue = passwordResult.valid && passwordsMatch && !submitting;

  const strength = passwordResult.valid
    ? passwordResult.strength
    : password.length > 0
      ? 'weak'
      : null;

  const handleContinue = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete(password);
    } catch {
      setSubmitError('Failed to create wallet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      style={styles.container}
      accessibilityLabel={flow === 'create' ? 'Set password' : 'Set password'}
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>{flow === 'create' ? 'Create' : 'Import'}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Set a password
        </Text>
        <Text style={styles.description}>This password unlocks your wallet on this device.</Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          onChangeText={setPassword}
          placeholder="Enter a strong password"
          secureTextEntry
          value={password}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {strength && (
        <View
          style={styles.strengthContainer}
          accessibilityLabel={`Password strength: ${strength}`}
        >
          <View style={styles.strengthBarBackground}>
            <View
              style={[
                styles.strengthBar,
                {
                  backgroundColor: STRENGTH_COLORS[strength],
                  width: strength === 'weak' ? '33%' : strength === 'medium' ? '66%' : '100%',
                },
              ]}
            />
          </View>
          <Text style={styles.strengthLabel}>{STRENGTH_LABELS[strength]}</Text>
        </View>
      )}

      {password.length > 0 && !passwordResult.valid && (
        <View accessibilityLabel="Password requirements" style={styles.errorList}>
          {passwordResult.reasons.map((reason: string, index: number) => (
            <Text key={index} style={styles.errorItem}>
              • {reason}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          accessibilityLabel="Confirm password"
          onChangeText={setConfirmPassword}
          placeholder="Re-enter your password"
          secureTextEntry
          value={confirmPassword}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {confirmPassword.length > 0 && !passwordsMatch && (
        <Text style={styles.errorText}>Passwords do not match.</Text>
      )}

      {submitError && (
        <Text accessibilityLiveRegion="polite" style={styles.submitError} accessibilityRole="alert">
          {submitError}
        </Text>
      )}

      <View style={styles.buttonContainer}>
        <Pressable onPress={onBack} style={styles.button}>
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>Back</Text>
          )}
        </Pressable>
        <Pressable onPress={onCancel} style={styles.button}>
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>Cancel</Text>
          )}
        </Pressable>
        <Pressable
          disabled={!canContinue}
          onPress={handleContinue}
          style={[styles.button, styles.primaryButton, !canContinue && styles.buttonDisabled]}
        >
          {({ pressed }) => (
            <Text
              style={[styles.buttonText, styles.primaryButtonText, pressed && styles.buttonPressed]}
            >
              {submitting ? 'Setting up...' : 'Continue'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748b',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
  },
  description: {
    fontSize: 14,
    color: '#475569',
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  strengthContainer: {
    gap: 4,
  },
  strengthBarBackground: {
    height: 6,
    width: '100%',
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
  },
  strengthLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  errorList: {
    paddingLeft: 20,
    gap: 4,
  },
  errorItem: {
    fontSize: 12,
    color: '#dc2626',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  submitError: {
    fontSize: 14,
    color: '#dc2626',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
