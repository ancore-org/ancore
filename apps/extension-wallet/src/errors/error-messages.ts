/**
 * Error Messages Module
 *
 * Defines structured, user-friendly error messages for each type of error.
 * These messages are used by the ErrorScreen component and error handler.
 */

/**
 * Error categories for classification
 */
export enum ErrorCategory {
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
export const ERROR_MESSAGES: Record<ErrorCategory, ErrorMessage> = {
  [ErrorCategory.NETWORK]: {
    title: 'Network Error',
    description: 'Unable to connect to the server. Please check your internet connection.',
    recoveryHint: 'Try again in a few moments',
    canRetry: true,
    canReset: false,
  },
  [ErrorCategory.VALIDATION]: {
    title: 'Validation Error',
    description: 'The information you provided is invalid. Please check your input and try again.',
    recoveryHint: 'Review your input and correct any errors',
    canRetry: true,
    canReset: true,
  },
  [ErrorCategory.CONTRACT]: {
    title: 'Contract Error',
    description:
      'A smart contract interaction failed. This may be due to insufficient funds or contract constraints.',
    recoveryHint: 'Ensure you have enough balance and try again',
    canRetry: true,
    canReset: false,
  },
  [ErrorCategory.UNKNOWN]: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again or restart the application.',
    recoveryHint: 'If the problem persists, please contact support',
    canRetry: true,
    canReset: true,
  },
};

/**
 * Additional specific error messages for common scenarios
 */
export const SPECIFIC_ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Network-specific errors
  ECONNREFUSED: {
    title: 'Server Unavailable',
    description: 'The server is not responding. Please try again later.',
    recoveryHint: 'Check your internet connection',
    canRetry: true,
    canReset: false,
  },
  ETIMEDOUT: {
    title: 'Request Timeout',
    description: 'The request took too long and was cancelled.',
    recoveryHint: 'Check your connection and try again',
    canRetry: true,
    canReset: false,
  },
  ENOTFOUND: {
    title: 'Page Not Found',
    description: 'The requested resource could not be found.',
    recoveryHint: 'The URL may be incorrect or outdated',
    canRetry: true,
    canReset: false,
  },

  // Validation-specific errors
  INVALID_ADDRESS: {
    title: 'Invalid Address',
    description: 'The wallet address format is invalid.',
    recoveryHint: 'Check the address and try again',
    canRetry: true,
    canReset: true,
  },
  INSUFFICIENT_BALANCE: {
    title: 'Insufficient Balance',
    description: 'You do not have enough balance to complete this transaction.',
    recoveryHint: 'Add more funds to your wallet',
    canRetry: true,
    canReset: false,
  },
  INVALID_AMOUNT: {
    title: 'Invalid Amount',
    description: 'The amount entered is invalid.',
    recoveryHint: 'Enter a valid positive number',
    canRetry: true,
    canReset: true,
  },

  // Contract-specific errors
  CONTRACT_CALL_FAILED: {
    title: 'Transaction Failed',
    description: 'The smart contract call failed.',
    recoveryHint: 'Check your balance and try again',
    canRetry: true,
    canReset: false,
  },
  CONTRACT_NOT_FOUND: {
    title: 'Contract Not Found',
    description: 'The smart contract could not be found.',
    recoveryHint: 'The contract may not be deployed',
    canRetry: true,
    canReset: false,
  },

  // Authentication errors
  UNAUTHORIZED: {
    title: 'Unauthorized',
    description: 'You are not authorized to perform this action.',
    recoveryHint: 'Please log in again',
    canRetry: true,
    canReset: true,
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    description: 'Your session has expired. Please log in again.',
    recoveryHint: 'Log in to continue',
    canRetry: true,
    canReset: true,
  },
};

/**
 * Get error message by category or specific error code
 * @param category - The error category
 * @param errorCode - Optional specific error code
 * @returns The appropriate error message
 */
export function getErrorMessage(category: ErrorCategory, errorCode?: string): ErrorMessage {
  // First try to find a specific error message
  if (errorCode && SPECIFIC_ERROR_MESSAGES[errorCode]) {
    return SPECIFIC_ERROR_MESSAGES[errorCode];
  }

  // Fall back to category-level message
  return ERROR_MESSAGES[category] || ERROR_MESSAGES[ErrorCategory.UNKNOWN];
}

/**
 * Get a fallback message for unknown errors
 * @returns Default error message for unknown errors
 */
export function getFallbackErrorMessage(): ErrorMessage {
  return ERROR_MESSAGES[ErrorCategory.UNKNOWN];
}
