import { useCallback } from 'react';
import type { ErrorInfo } from 'react';

export function useWidgetErrorLogger() {
  return useCallback((error: Error, info: ErrorInfo) => {
    const sanitizedError = {
      name: error.name,
      message: error.message,
    };

    console.error('[Widget Error Logger] Caught isolated widget failure:', sanitizedError);
    console.error('[Widget Error Logger] Component Stack:', info.componentStack);
  }, []);
}
