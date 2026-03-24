/**
 * Error Handler Module
 *
 * Provides global error classification and handling functionality.
 * Classifies errors into network, validation, or contract errors and logs them locally.
 */
import { ErrorMessage } from './error-messages';
/**
 * Error categories for classification
 */
export declare enum ErrorCategory {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  CONTRACT = 'CONTRACT',
  UNKNOWN = 'UNKNOWN',
}
/**
 * Structured error information
 */
export interface ErrorInfo {
  category: ErrorCategory;
  code?: string;
  message: string;
  originalError: Error | unknown;
  timestamp: Date;
  recoverable: boolean;
}
/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Enable console logging */
  logToConsole?: boolean;
  /** Enable localStorage logging */
  logToStorage?: boolean;
  /** Maximum number of errors to store */
  maxStoredErrors?: number;
  /** Storage key for error logs */
  storageKey?: string;
}
/**
 * Global error handler class
 */
export declare class ErrorHandler {
  private config;
  private errorLog;
  constructor(config?: ErrorHandlerConfig);
  /**
   * Classify an error into a category
   * @param error - The error to classify
   * @returns The error category
   */
  classifyError(error: unknown): ErrorCategory;
  /**
   * Extract error code from error
   * @param error - The error to extract code from
   * @returns Error code if found
   */
  extractErrorCode(error: unknown): string | undefined;
  /**
   * Handle and log an error
   * @param error - The error to handle
   * @param context - Optional context information
   * @returns Structured error information
   */
  handleError(error: unknown, context?: string): ErrorInfo;
  /**
   * Check if an error is recoverable
   * @param category - The error category
   * @returns Whether the error is recoverable
   */
  isRecoverable(category: ErrorCategory): boolean;
  /**
   * Get user-friendly error message
   * @param error - The error or ErrorInfo
   * @returns User-friendly error message
   */
  getUserMessage(error: ErrorInfo | unknown): ErrorMessage;
  /**
   * Log error to console and/or storage
   * @param errorInfo - The error information to log
   */
  private logError;
  /**
   * Convert error to string for classification
   * @param error - The error to convert
   * @returns String representation
   */
  private errorToString;
  /**
   * Load error log from localStorage
   */
  private loadErrorLog;
  /**
   * Save error log to localStorage
   */
  private saveErrorLog;
  /**
   * Get all logged errors
   * @returns Array of error information
   */
  getErrorLog(): ErrorInfo[];
  /**
   * Clear error log
   */
  clearErrorLog(): void;
}
/**
 * Get the default error handler instance
 * @returns The default ErrorHandler instance
 */
export declare function getErrorHandler(): ErrorHandler;
/**
 * Handle an error with the default handler
 * @param error - The error to handle
 * @param context - Optional context
 * @returns ErrorInfo
 */
export declare function handleError(error: unknown, context?: string): ErrorInfo;
/**
 * Classify an error with the default handler
 * @param error - The error to classify
 * @returns ErrorCategory
 */
export declare function classifyError(error: unknown): ErrorCategory;
/**
 * Get user-friendly message for an error
 * @param error - The error
 * @returns ErrorMessage
 */
export declare function getErrorUserMessage(error: unknown): ErrorMessage;
/**
 * Wrap an async function with error handling
 * @param fn - The async function to wrap
 * @param context - Context for error messages
 * @returns Wrapped function
 */
export declare function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: string
): (...args: Parameters<T>) => Promise<ErrorInfo | ReturnType<T>>;
/**
 * Create a retryable async function
 * @param fn - The async function to wrap
 * @param maxRetries - Maximum number of retries
 * @param delay - Delay between retries in ms
 * @returns Retryable function
 */
export declare function createRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  maxRetries?: number,
  delay?: number
): (...args: Parameters<T>) => Promise<ErrorInfo | ReturnType<T>>;
//# sourceMappingURL=error-handler.d.ts.map
