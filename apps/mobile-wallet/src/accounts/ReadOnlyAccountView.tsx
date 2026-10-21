import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import type { ReadOnlyAccount } from './read-only-account';
import { copyToClipboardWithHaptic } from '../utils/clipboard';

interface Props {
  account: ReadOnlyAccount;
  accountContractId: string;
}

export const ReadOnlyAccountView = ({ account, accountContractId }: Props) => {
  const handleCopyAddress = async () => {
    try {
      await copyToClipboardWithHaptic(account.address.value);
      // Optional: Show a toast or brief notification
      Alert.alert('Copied', 'Address copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy address');
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="Read-only account">
      <Text style={styles.heading}>Account</Text>
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>
            {account.status === 'ready' ? 'Ready' : 'Configure an account address'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Address</Text>
          <Pressable
            onPress={handleCopyAddress}
            style={styles.addressPill}
            accessibilityLabel="Copy address to clipboard"
            accessibilityHint="Tap to copy your public address"
          >
            {({ pressed }) => (
              <Text style={[styles.addressText, pressed && styles.addressPressed]}>
                {account.address.value}
              </Text>
            )}
          </Pressable>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Network</Text>
          <Text style={styles.value}>{account.network.network}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Account contract</Text>
          <Text style={styles.value}>{accountContractId}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  infoContainer: {
    gap: 16,
  },
  infoRow: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  value: {
    fontSize: 16,
    color: '#334155',
  },
  addressPill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#1e293b',
  },
  addressPressed: {
    opacity: 0.7,
  },
});
