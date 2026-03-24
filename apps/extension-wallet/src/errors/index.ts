/**
 * Error Handling System - Index
 *
 * Exports all error handling components, functions, and types.
 */

// ErrorBoundary components
export {
  ErrorBoundary,
  useErrorHandler,
  withErrorBoundary,
  ErrorBoundaryReset,
} from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';

// ErrorScreen components
export { ErrorScreen, ErrorCard, AsyncErrorHandler } from './ErrorScreen';
export type { ErrorScreenProps } from './ErrorScreen';

// Error handler
export {
  ErrorHandler,
  ErrorCategory,
  handleError,
  classifyError,
  getErrorUserMessage,
  withErrorHandling,
  createRetryable,
  getErrorHandler,
} from './error-handler';
export type { ErrorInfo, ErrorHandlerConfig } from './error-handler';

// Error messages
export {
  getErrorMessage,
  getFallbackErrorMessage,
  ERROR_MESSAGES,
  SPECIFIC_ERROR_MESSAGES,
} from './error-messages';
export type { ErrorMessage } from './error-messages';
