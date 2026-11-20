import { View, Text, Pressable, StyleSheet } from 'react-native';

type Props = {
  onCreate?: () => void;
  onImport?: () => void;
  onRecover?: () => void;
};

const noop = () => {};

export function OnboardingEntryScreen({
  onCreate = noop,
  onImport = noop,
  onRecover = noop,
}: Props) {
  return (
    <View style={styles.container} accessibilityLabel="Onboarding entry">
      <View style={styles.header}>
        <Text style={styles.subtitle}>Onboarding</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Set up your wallet
        </Text>
        <Text style={styles.description}>
          Choose a setup path to continue into the onboarding flow.
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        <Pressable onPress={onCreate} style={styles.button}>
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>
              Create a new wallet
            </Text>
          )}
        </Pressable>
        <Pressable onPress={onImport} style={styles.button}>
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>
              Import an existing wallet
            </Text>
          )}
        </Pressable>
        <Pressable onPress={onRecover} style={styles.button}>
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>
              Recover from backup
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
  buttonGroup: {
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
