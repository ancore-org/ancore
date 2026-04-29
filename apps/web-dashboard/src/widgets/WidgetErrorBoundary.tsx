import React from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Card, CardContent } from '@ancore/ui-kit';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useWidgetErrorLogger } from '../hooks/useWidgetErrorLogger';

export const WidgetErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <Card className="h-full border-red-200 bg-red-50 overflow-hidden">
      <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[120px]">
        <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
        <h3 className="text-sm font-semibold text-red-800 mb-1">Widget Failed</h3>
        <p className="text-xs text-red-600 mb-4 max-w-full truncate" title={error.message}>
          {error.message}
        </p>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-md transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </CardContent>
    </Card>
  );
};

export const WidgetErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const logError = useWidgetErrorLogger();

  return (
    <ErrorBoundary
      FallbackComponent={WidgetErrorFallback}
      onError={logError}
    >
      {children}
    </ErrorBoundary>
  );
};