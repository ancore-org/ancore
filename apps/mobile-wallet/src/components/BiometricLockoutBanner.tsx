import { StyleSheet, Text, View } from 'react-native';

type Props = {
  isPermanent: boolean;
  secondsRemaining: number;
  message: string | null;
};

export const BiometricLockoutBanner = ({ isPermanent, secondsRemaining, message }: Props) => {
  const title = isPermanent
    ? 'Biometric authentication disabled'
    : `Temporarily locked — ${secondsRemaining}s remaining`;

  const body = isPermanent
    ? 'Your device has permanently disabled biometric access. Use your password below, or re-enroll biometrics in your device settings.'
    : (message ?? 'Too many failed attempts. Wait for the timer or use your password to unlock.');

  return (
    <View
      accessibilityLabel={`${title}. ${body}`}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={styles.container}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f1d1d',
  },
  body: {
    fontSize: 14,
    color: '#b91c1c',
  },
});
