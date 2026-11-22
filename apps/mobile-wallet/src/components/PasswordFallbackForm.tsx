import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  onSubmit: (password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export const PasswordFallbackForm = ({ onSubmit, isLoading, error }: Props) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = !isLoading && password.trim().length > 0;

  // There is no <form onSubmit> in React Native: the Unlock button's onPress and the
  // keyboard's "go" key (onSubmitEditing) both call this.
  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(password);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Password</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          autoFocus
          editable={!isLoading}
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
          secureTextEntry={!showPassword}
          style={[styles.input, error ? styles.inputInvalid : null]}
          textContentType="password"
          value={password}
        />
        <Pressable
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          accessibilityRole="button"
          onPress={() => setShowPassword((visible) => !visible)}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      {error ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={handleSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>{isLoading ? 'Unlocking…' : 'Unlock'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#334155',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputInvalid: {
    borderColor: '#dc2626',
  },
  toggle: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  toggleText: {
    fontSize: 14,
    color: '#3b82f6',
  },
  error: {
    fontSize: 14,
    color: '#dc2626',
  },
  submit: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
});
