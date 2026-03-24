/**
 * ErrorScreen Component
 *
 * Displays user-friendly error messages with recovery options
 * (retry or reset). Used by ErrorBoundary as the fallback UI.
 */
import { ReactNode } from 'react';
import { ErrorInfo } from './error-handler';
export interface ErrorScreenProps {
  /** The error that was thrown */
  error?: globalThis.Error;
  /** Processed error information from the error handler */
  errorInfo?: ErrorInfo;
  /** Callback when retry is clicked */
  onRetry?: () => void;
  /** Callback when reset is clicked */
  onReset?: () => void;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Additional content to render */
  children?: ReactNode;
  /** Show technical details (error message, stack) */
  showDetails?: boolean;
  /** CSS class name */
  className?: string;
}
/**
 * ErrorScreen displays a user-friendly error page with recovery options
 *
 * @example
 * ```tsx
 * <ErrorScreen
 *   error={error}
 *   errorInfo={errorInfo}
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export declare function ErrorScreen({
  error,
  errorInfo,
  onRetry,
  onReset,
  title,
  description,
  children,
  showDetails,
  className,
}: ErrorScreenProps): JSX.Element;
/**
 * Props for ErrorCard component (inline error display)
 */
interface ErrorCardProps {
  /** Error message to display */
  message: string;
  /** Optional callback for retry */
  onRetry?: () => void;
  /** Error severity level */
  variant?: 'error' | 'warning' | 'info';
  /** CSS class name */
  className?: string;
}
/**
 * ErrorCard - A compact inline error display component
 * Use this for inline errors within forms or smaller contexts
 *
 * @example
 * ```tsx
 * <ErrorCard
 *   message="Failed to load data"
 *   onRetry={refetch}
 * />
 * ```
 */
export declare function ErrorCard({
  message,
  onRetry,
  variant,
  className,
}: ErrorCardProps): JSX.Element;
/**
 * Props for AsyncErrorHandler component
 */
interface AsyncErrorHandlerProps {
  /** The error that occurred */
  error: unknown;
  /** Callback to retry the async operation */
  onRetry?: () => void;
  /** Callback to reset the component state */
  onReset?: () => void;
  /** Whether to show compact mode */
  compact?: boolean;
}
/**
 * AsyncErrorHandler - Handles errors from async operations
 * Use this in components that perform async operations
 *
 * @example
 * ```tsx
 * const { data, error, refetch } = useQuery();
 *
 * if (error) {
 *   return (
 *     <AsyncErrorHandler
 *       error={error}
 *       onRetry={refetch}
 *     />
 *   );
 * }
 * ```
 */
export declare function AsyncErrorHandler({
  error,
  onRetry,
  onReset,
  compact,
}: AsyncErrorHandlerProps): JSX.Element;
export { handleError } from './error-handler';
//# sourceMappingURL=ErrorScreen.d.ts.map
