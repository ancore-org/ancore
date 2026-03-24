/**
 * ErrorBoundary Component
 *
 * A reusable React ErrorBoundary that wraps the app and catches rendering errors.
 * Uses react-error-boundary library for robust error handling.
 */
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorCategory } from './error-handler';
export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Fallback component to render on error (optional) */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: globalThis.Error, errorInfo: ErrorInfo) => void;
  /** Callback when reset is attempted */
  onReset?: () => void;
}
/**
 * ErrorBoundary component that catches React rendering errors
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export declare function ErrorBoundary({
  children,
  fallback,
  onError,
}: ErrorBoundaryProps): JSX.Element;
/**
 * Hook for handling async errors in components
 * Use this to catch errors in event handlers and async functions
 *
 * @example
 * ```tsx
 * const { reset, dispatch } = useErrorHandler();
 *
 * const handleClick = async () => {
 *   try {
 *     await someAsyncOperation();
 *   } catch (error) {
 *     dispatch(error);
 *   }
 * };
 * ```
 */
export declare function useErrorHandler(): {
  /** Dispatch an error to the boundary */
  dispatch: (error: unknown) => void;
  /** Clear the error boundary state */
  reset: () => void;
};
/**
 * Higher-order component wrapper for error handling async operations
 *
 * @example
 * ```tsx
 * const WrappedComponent = withErrorBoundary(MyComponent);
 * ```
 */
export declare function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
): React.ComponentType<P>;
/**
 * Props for ErrorBoundaryReset component
 */
interface ErrorBoundaryResetProps {
  /** Children to render */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}
/**
 * A button component that resets the ErrorBoundary when clicked
 * Useful for triggering error recovery
 */
export declare function ErrorBoundaryReset({
  children,
  className,
}: ErrorBoundaryResetProps): JSX.Element;
export { ErrorCategory };
export type { ErrorInfo };
//# sourceMappingURL=ErrorBoundary.d.ts.map
