import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ErrorKind } from '../screens/history/errorTypes';

type Props = {
  kind: ErrorKind;
  message: string;
  statusCode?: number;
  onRetry: () => void;
  isRetrying?: boolean;
};

const ERROR_MESSAGES: Record<ErrorKind, { title: string; description: string }> = {
  network: {
    title: 'Connection Error',
    description:
      'Unable to connect to the transaction service. Check your internet connection and try again.',
  },
  server: {
    title: 'Server Error',
    description: 'The transaction service encountered an error. Please try again later.',
  },
  configuration: {
    title: 'Configuration Error',
    description:
      'The transaction service is not properly configured. Please contact support or check your settings.',
  },
  unknown: {
    title: 'Error Loading Transactions',
    description: 'An unexpected error occurred. Please try again.',
  },
};

export const HistoryError = ({ kind, message, statusCode, onRetry, isRetrying = false }: Props) => {
  const errorInfo = ERROR_MESSAGES[kind];

  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.container}>
      <View>
        <Text accessibilityRole="header" style={styles.title}>
          {errorInfo.title}
        </Text>
        <Text style={styles.description}>{errorInfo.description}</Text>
      </View>

      {/* A ternary, not `statusCode && ...`: a status of 0 would render a bare "0" inside a View. */}
      {statusCode ? (
        <Text style={styles.status}>
          HTTP {statusCode}
          {statusCode >= 500 ? ' - Server Error' : statusCode >= 400 ? ' - Client Error' : ''}
        </Text>
      ) : null}

      {kind === 'configuration' ? (
        <View style={styles.detail}>
          <Text style={styles.detailText}>{message}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel={isRetrying ? 'Retrying...' : 'Retry loading transactions'}
        accessibilityRole="button"
        accessibilityState={{ disabled: isRetrying }}
        disabled={isRetrying}
        onPress={onRetry}
        style={[styles.button, isRetrying && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{isRetrying ? 'Retrying…' : 'Retry'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7f1d1d',
  },
  description: {
    marginTop: 4,
    fontSize: 14,
    color: '#b91c1c',
  },
  status: {
    fontSize: 12,
    color: '#dc2626',
  },
  detail: {
    padding: 12,
    borderRadius: 4,
    backgroundColor: '#fee2e2',
  },
  detailText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#991b1b',
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
  },
});
