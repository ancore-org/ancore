export type ErrorKind = 'network' | 'server' | 'configuration' | 'unknown';

export type HistoryError = {
  kind: ErrorKind;
  message: string;
  statusCode?: number;
};

/**
 * Detects error type from adapter failure
 * - Network errors: connection failures, timeouts
 * - Server errors: 4xx/5xx HTTP responses
 * - Configuration errors: missing INDEXER_URL
 * - Unknown: other errors
 */
export const detectErrorKind = (error: unknown): HistoryError => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('offline') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return {
        kind: 'network',
        message: error.message,
      };
    }

    // Configuration errors
    if (
      message.includes('indexer_url') ||
      message.includes('indexer url') ||
      message.includes('not configured') ||
      message.includes('missing config')
    ) {
      return {
        kind: 'configuration',
        message: error.message,
      };
    }

    // Server errors (4xx/5xx)
    const statusMatch = message.match(/(\d{3})/);
    if (statusMatch) {
      const statusCode = parseInt(statusMatch[1], 10);
      if (statusCode >= 400) {
        return {
          kind: 'server',
          message: error.message,
          statusCode,
        };
      }
    }
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    kind: 'unknown',
    message: errorMessage || 'Unable to load transactions.',
  };
};
