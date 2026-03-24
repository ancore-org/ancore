/**
 * Error Messages Module
 *
 * Defines structured, user-friendly error messages for each type of error.
 * These messages are used by the ErrorScreen component and error handler.
 */
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
 * User-friendly error message structure
 */
export interface ErrorMessage {
  title: string;
  description: string;
  recoveryHint?: string;
  canRetry: boolean;
  canReset: boolean;
}
/**
 * Map of error categories to their user-friendly messages
 */
export declare const ERROR_MESSAGES: Record<ErrorCategory, ErrorMessage>;
/**
 * Additional specific error messages for common scenarios
 */
export declare const SPECIFIC_ERROR_MESSAGES: Record<string, ErrorMessage>;
/**
 * Get error message by category or specific error code
 * @param category - The error category
 * @param errorCode - Optional specific error code
 * @returns The appropriate error message
 */
export declare function getErrorMessage(category: ErrorCategory, errorCode?: string): ErrorMessage;
/**
 * Get a fallback message for unknown errors
 * @returns Default error message for unknown errors
 */
export declare function getFallbackErrorMessage(): ErrorMessage;
//# sourceMappingURL=error-messages.d.ts.map
