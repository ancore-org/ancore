import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  onBack?: () => void;
  onCancel?: () => void;
  onContinue?: (walletName: string) => void;
};

const noop = () => {};

export function WalletCreateScreen({ onBack = noop, onCancel = noop, onContinue = noop }: Props) {
  const [walletName, setWalletName] = React.useState('');
  const canContinue = walletName.trim().length > 0;

  return (
    <View accessible accessibilityLabel="Create wallet" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Create</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Create a new wallet
        </Text>
        <Text style={styles.description}>
          Enter a name for your wallet. You will be guided through creating a recovery phrase.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Wallet name</Text>
        <TextInput
          accessibilityLabel="Wallet name"
          onChangeText={setWalletName}
          placeholder="My wallet"
          style={styles.input}
          value={walletName}
        />
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.button}>
          <Text>Back</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.button}>
          <Text>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue}
          onPress={() => onContinue(walletName.trim())}
          style={[styles.button, !canContinue && styles.disabledButton]}
        >
          <Text>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, padding: 24 },
  header: { gap: 8 },
  eyebrow: { color: '#64748b', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#020617', fontSize: 24, fontWeight: '600' },
  description: { color: '#475569', fontSize: 14 },
  field: { gap: 8 },
  label: { color: '#334155', fontSize: 14 },
  input: { borderColor: '#cbd5e1', borderRadius: 6, borderWidth: 1, padding: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabledButton: { opacity: 0.5 },
});
