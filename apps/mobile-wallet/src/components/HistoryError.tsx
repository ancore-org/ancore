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
    <section
      className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg"
      role="alert"
      aria-live="polite"
    >
      <div>
        <h2 className="text-lg font-semibold text-red-900">{errorInfo.title}</h2>
        <p className="text-sm text-red-700 mt-1">{errorInfo.description}</p>
      </div>

      {statusCode && (
        <p className="text-xs text-red-600">
          HTTP {statusCode}
          {statusCode >= 500 ? ' - Server Error' : statusCode >= 400 ? ' - Client Error' : ''}
        </p>
      )}

      {kind === 'configuration' && (
        <div className="bg-red-100 p-3 rounded text-sm text-red-800">
          <p className="font-mono text-xs break-all">{message}</p>
        </div>
      )}

      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label={isRetrying ? 'Retrying...' : 'Retry loading transactions'}
      >
        {isRetrying ? 'Retrying…' : 'Retry'}
      </button>
    </section>
  );
};
