import { StyleSheet, Text, View } from 'react-native';

type Props = {
  attemptsRemaining: number;
  maxAttempts: number;
  message: string | null;
};

export const AttemptsIndicator = ({ attemptsRemaining, maxAttempts, message }: Props) => {
  return (
    <View
      accessibilityLabel={`${attemptsRemaining} of ${maxAttempts} attempts remaining`}
      accessible
      style={styles.container}
    >
      {/* The dots are decorative: the label above already says how many are left. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.dots}
      >
        {Array.from({ length: maxAttempts }).map((_, i) => {
          const used = i >= attemptsRemaining;
          return (
            <View
              key={i}
              style={[styles.dot, used ? styles.dotUsed : styles.dotAvailable]}
              testID={used ? 'attempt-used' : 'attempt-available'}
            />
          );
        })}
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotAvailable: {
    backgroundColor: '#22c55e',
  },
  dotUsed: {
    backgroundColor: '#e2e8f0',
  },
  message: {
    fontSize: 14,
    color: '#475569',
  },
});
