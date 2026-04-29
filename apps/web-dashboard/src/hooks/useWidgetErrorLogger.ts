import { useCallback } from 'react';
import type { ErrorInfo } from 'react';

export function useWidgetErrorLogger() {
  return useCallback((error: Error, info: ErrorInfo) => {
    // Invoking our centralized logging mechanism.
    // In a production app, this would route to an external service (e.g., Sentry, Datadog).
    console.error('[Widget Error Logger] Caught isolated widget failure:', error);
    console.error('[Widget Error Logger] Component Stack:', info.componentStack);
  }, []);
}