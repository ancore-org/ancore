/**
 * Error Messages Module
 *
 * Defines structured, user-friendly error messages for each type of error.
 * These messages are used by the ErrorScreen component and error handler.
 *
 * Issue #1028 — expanded send/sign/relayer/Horizon error coverage.
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

  // ── Send / sign errors (issue #1028) ──────────────────────────────────────

  // Horizon / Stellar submission errors
  tx_bad_seq: {
    title: 'Sequence Mismatch',
    description: 'The transaction sequence number is out of order.',
    recoveryHint: 'Refresh and try again — a previous transaction may still be pending',
    canRetry: true,
    canReset: false,
  },
  tx_bad_auth: {
    title: 'Bad Signature',
    description: 'The transaction signature is invalid or from the wrong key.',
    recoveryHint: 'Ensure you are signing with the correct wallet',
    canRetry: false,
    canReset: true,
  },
  tx_insufficient_balance: {
    title: 'Insufficient Balance',
    description: 'Your account does not have enough XLM to cover the amount plus fees.',
    recoveryHint: 'Add more XLM or reduce the send amount',
    canRetry: false,
    canReset: true,
  },
  tx_insufficient_fee: {
    title: 'Fee Too Low',
    description: 'The network fee was too low for the current base fee.',
    recoveryHint: 'Retry — the fee estimate will be refreshed automatically',
    canRetry: true,
    canReset: false,
  },
  tx_no_destination: {
    title: 'Recipient Not Found',
    description: 'The recipient account does not exist on the Stellar network.',
    recoveryHint: 'Check the address or ask the recipient to fund their account first',
    canRetry: false,
    canReset: true,
  },
  op_no_destination: {
    title: 'Recipient Not Found',
    description: 'The destination account does not exist on the network.',
    recoveryHint: 'Verify the recipient address and try again',
    canRetry: false,
    canReset: true,
  },
  tx_failed: {
    title: 'Transaction Failed',
    description: 'The transaction was rejected by the Stellar network.',
    recoveryHint: 'Review the transaction details and try again',
    canRetry: true,
    canReset: false,
  },

  // Relayer errors
  RELAY_REJECTED: {
    title: 'Relay Rejected',
    description: 'The relayer could not submit your transaction.',
    recoveryHint: 'Try again in a moment or check the relayer status',
    canRetry: true,
    canReset: false,
  },
  NONCE_REPLAY: {
    title: 'Duplicate Request',
    description: 'This transaction has already been submitted.',
    recoveryHint: 'Check your transaction history before retrying',
    canRetry: false,
    canReset: false,
  },
  INVALID_SIGNATURE: {
    title: 'Invalid Signature',
    description: 'The transaction signature was rejected by the relayer.',
    recoveryHint: 'Re-sign the transaction and try again',
    canRetry: true,
    canReset: true,
  },
  SESSION_KEY_EXPIRED: {
    title: 'Session Key Expired',
    description: 'The session key used to sign this transaction has expired.',
    recoveryHint: 'Request a new session key in Settings → Session Keys',
    canRetry: false,
    canReset: false,
  },
  SESSION_KEY_NOT_FOUND: {
    title: 'Session Key Not Found',
    description: 'The session key was not found on the account contract.',
    recoveryHint: 'Verify your session keys or use your main wallet key',
    canRetry: false,
    canReset: false,
  },
  GAS_LIMIT_EXCEEDED: {
    title: 'Resource Limit Exceeded',
    description: 'The transaction exceeded the Soroban resource limits.',
    recoveryHint: 'The operation may be too complex — try a simpler transaction',
    canRetry: false,
    canReset: false,
  },

  // Signing flow errors
  USER_REJECTED: {
    title: 'Transaction Cancelled',
    description: 'You cancelled the signing request.',
    recoveryHint: 'Start a new transaction when you are ready',
    canRetry: false,
    canReset: true,
  },
  APPROVAL_TIMEOUT: {
    title: 'Signing Timed Out',
    description: 'The approval request expired before it was confirmed.',
    recoveryHint: 'Re-initiate the transaction and approve it promptly',
    canRetry: true,
    canReset: false,
  },
  WALLET_LOCKED: {
    title: 'Wallet Locked',
    description: 'Your wallet is locked. Unlock it to sign transactions.',
    recoveryHint: 'Unlock your wallet and try again',
    canRetry: true,
    canReset: false,
  },
  HARDWARE_WALLET_ERROR: {
    title: 'Hardware Wallet Error',
    description: 'Could not communicate with your hardware wallet.',
    recoveryHint: 'Check the USB connection and ensure the Stellar app is open',
    canRetry: true,
    canReset: false,
  },
  LEDGER_BLIND_SIGNING_DISABLED: {
    title: 'Blind Signing Disabled',
    description: 'Blind signing is disabled on your Ledger device.',
    recoveryHint: 'Enable blind signing in the Stellar app settings on your Ledger',
    canRetry: false,
    canReset: false,
  },

  // Simulation errors
  SIMULATION_FAILED: {
    title: 'Simulation Failed',
    description: 'The transaction simulation returned an error.',
    recoveryHint: 'Review the transaction details — it may fail on-chain',
    canRetry: true,
    canReset: false,
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
 * Look up a user-facing message directly by error code string.
 * Useful when callers already have the raw error code from the relayer or
 * Horizon and want to skip the classification step.
 *
 * @param code - Raw error code (e.g. "tx_bad_seq", "NONCE_REPLAY")
 * @returns The matching ErrorMessage, or the UNKNOWN fallback
 */
export function getErrorMessageByCode(code: string): ErrorMessage {
  return SPECIFIC_ERROR_MESSAGES[code] ?? ERROR_MESSAGES[ErrorCategory.UNKNOWN];
}

/**
 * Get a fallback message for unknown errors
 * @returns Default error message for unknown errors
 */
export function getFallbackErrorMessage(): ErrorMessage {
  return ERROR_MESSAGES[ErrorCategory.UNKNOWN];
}
