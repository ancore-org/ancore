/**
 * Error Handler Module
 *
 * Provides global error classification and handling functionality.
 * Classifies errors into network, validation, or contract errors and logs them locally.
 */
import { getErrorMessage } from './error-messages';
/**
 * Error categories for classification
 */
export var ErrorCategory;
(function (ErrorCategory) {
  ErrorCategory['NETWORK'] = 'NETWORK';
  ErrorCategory['VALIDATION'] = 'VALIDATION';
  ErrorCategory['CONTRACT'] = 'CONTRACT';
  ErrorCategory['UNKNOWN'] = 'UNKNOWN';
})(ErrorCategory || (ErrorCategory = {}));
/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  logToConsole: true,
  logToStorage: true,
  maxStoredErrors: 50,
  storageKey: 'extension_error_log',
};
/**
 * Network error patterns for classification
 */
const NETWORK_ERROR_PATTERNS = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
  'fetch failed',
  'network request failed',
  'Failed to fetch',
  'NetworkError',
  'net::ERR_',
];
/**
 * Validation error patterns for classification
 */
const VALIDATION_ERROR_PATTERNS = [
  'validation failed',
  'invalid',
  'malformed',
  'bad request',
  '400',
  '422',
  'type error',
  'cannot read',
  'undefined is not',
  'null is not',
];
/**
 * Contract error patterns for classification
 */
const CONTRACT_ERROR_PATTERNS = [
  'contract',
  'smart contract',
  'execution reverted',
  'gas',
  'nonce',
  'insufficient',
  'balance',
  'allowance',
  'vault',
  'account',
];
/**
 * Global error handler class
 */
export class ErrorHandler {
  config;
  errorLog = [];
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadErrorLog();
  }
  /**
   * Classify an error into a category
   * @param error - The error to classify
   * @returns The error category
   */
  classifyError(error) {
    const errorString = this.errorToString(error).toLowerCase();
    // Check for network errors
    if (NETWORK_ERROR_PATTERNS.some((pattern) => errorString.includes(pattern.toLowerCase()))) {
      return ErrorCategory.NETWORK;
    }
    // Check for contract errors
    if (CONTRACT_ERROR_PATTERNS.some((pattern) => errorString.includes(pattern.toLowerCase()))) {
      return ErrorCategory.CONTRACT;
    }
    // Check for validation errors
    if (VALIDATION_ERROR_PATTERNS.some((pattern) => errorString.includes(pattern.toLowerCase()))) {
      return ErrorCategory.VALIDATION;
    }
    return ErrorCategory.UNKNOWN;
  }
  /**
   * Extract error code from error
   * @param error - The error to extract code from
   * @returns Error code if found
   */
  extractErrorCode(error) {
    if (error instanceof Error) {
      // Check for common error code patterns (e.g., ECONNREFUSED, ERR_NETWORK)
      const codeMatch = error.message.match(/\b([A-Z][A-Z0-9_]+)\b/);
      if (codeMatch) {
        return codeMatch[1];
      }
      // Check for HTTP status codes
      const statusMatch = error.message.match(/\b(4\d{2}|5\d{2})\b/);
      if (statusMatch) {
        return statusMatch[1];
      }
      // Check for node error code property
      if ('code' in error && typeof error.code === 'string') {
        return error.code;
      }
    }
    return undefined;
  }
  /**
   * Handle and log an error
   * @param error - The error to handle
   * @param context - Optional context information
   * @returns Structured error information
   */
  handleError(error, context) {
    const category = this.classifyError(error);
    const code = this.extractErrorCode(error);
    const message = error instanceof Error ? error.message : String(error);
    const errorInfo = {
      category,
      code,
      message,
      originalError: error,
      timestamp: new Date(),
      recoverable: this.isRecoverable(category),
    };
    // Add context if provided
    if (context) {
      errorInfo.message = `${context}: ${errorInfo.message}`;
    }
    // Log the error
    this.logError(errorInfo);
    return errorInfo;
  }
  /**
   * Check if an error is recoverable
   * @param category - The error category
   * @returns Whether the error is recoverable
   */
  isRecoverable(category) {
    return (
      category === ErrorCategory.NETWORK ||
      category === ErrorCategory.VALIDATION ||
      category === ErrorCategory.CONTRACT
    );
  }
  /**
   * Get user-friendly error message
   * @param error - The error or ErrorInfo
   * @returns User-friendly error message
   */
  getUserMessage(error) {
    // Check if error is already an ErrorInfo object using type guard
    if (error && typeof error === 'object' && 'category' in error && 'timestamp' in error) {
      const errInfo = error;
      return getErrorMessage(errInfo.category, errInfo.code);
    }
    // Handle unknown error
    const errorInfo = this.handleError(error);
    return getErrorMessage(errorInfo.category, errorInfo.code);
  }
  /**
   * Log error to console and/or storage
   * @param errorInfo - The error information to log
   */
  logError(errorInfo) {
    if (this.config.logToConsole) {
      console.error('[ErrorHandler]', {
        category: errorInfo.category,
        code: errorInfo.code,
        message: errorInfo.message,
        timestamp: errorInfo.timestamp.toISOString(),
        recoverable: errorInfo.recoverable,
      });
    }
    if (this.config.logToStorage) {
      this.errorLog.push(errorInfo);
      // Trim log if it exceeds max size
      if (this.errorLog.length > this.config.maxStoredErrors) {
        this.errorLog = this.errorLog.slice(-this.config.maxStoredErrors);
      }
      this.saveErrorLog();
    }
  }
  /**
   * Convert error to string for classification
   * @param error - The error to convert
   * @returns String representation
   */
  errorToString(error) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return JSON.stringify(error);
  }
  /**
   * Load error log from localStorage
   */
  loadErrorLog() {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        this.errorLog = JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
      this.errorLog = [];
    }
  }
  /**
   * Save error log to localStorage
   */
  saveErrorLog() {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.errorLog));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }
  /**
   * Get all logged errors
   * @returns Array of error information
   */
  getErrorLog() {
    return [...this.errorLog];
  }
  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
    this.saveErrorLog();
  }
}
// Default singleton instance
let defaultHandler = null;
/**
 * Get the default error handler instance
 * @returns The default ErrorHandler instance
 */
export function getErrorHandler() {
  if (!defaultHandler) {
    defaultHandler = new ErrorHandler();
  }
  return defaultHandler;
}
/**
 * Handle an error with the default handler
 * @param error - The error to handle
 * @param context - Optional context
 * @returns ErrorInfo
 */
export function handleError(error, context) {
  return getErrorHandler().handleError(error, context);
}
/**
 * Classify an error with the default handler
 * @param error - The error to classify
 * @returns ErrorCategory
 */
export function classifyError(error) {
  return getErrorHandler().classifyError(error);
}
/**
 * Get user-friendly message for an error
 * @param error - The error
 * @returns ErrorMessage
 */
export function getErrorUserMessage(error) {
  return getErrorHandler().getUserMessage(error);
}
/**
 * Wrap an async function with error handling
 * @param fn - The async function to wrap
 * @param context - Context for error messages
 * @returns Wrapped function
 */
export function withErrorHandling(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorInfo = handleError(error, context);
      return errorInfo;
    }
  };
}
/**
 * Create a retryable async function
 * @param fn - The async function to wrap
 * @param maxRetries - Maximum number of retries
 * @param delay - Delay between retries in ms
 * @returns Retryable function
 */
export function createRetryable(fn, maxRetries = 3, delay = 1000) {
  return async (...args) => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;
        // Don't retry on validation errors
        const category = classifyError(error);
        if (category === ErrorCategory.VALIDATION) {
          const errorInfo = handleError(error);
          return errorInfo;
        }
        // Wait before retrying
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
        }
      }
    }
    // All retries failed
    const errorInfo = handleError(lastError, `Retry failed after ${maxRetries} attempts`);
    return errorInfo;
  };
}
//# sourceMappingURL=error-handler.js.map
