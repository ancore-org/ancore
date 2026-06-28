import { NetworkError, SimulationFailedError, TransactionError } from '@ancore/stellar';
import type { RelayError } from '../types';

/**
 * Map Stellar network / submission errors to typed relay error responses.
 */
export function mapSubmissionError(error: unknown): RelayError {
  if (error instanceof SimulationFailedError) {
    return {
      code: 'SIMULATION_FAILED',
      message: error.message,
    };
  }

  if (error instanceof TransactionError) {
    const code = error.resultCode?.toLowerCase() ?? '';

    if (
      code.includes('fee') ||
      code.includes('resource') ||
      code.includes('insufficient') ||
      code === 'tx_insufficient_fee'
    ) {
      return {
        code: 'GAS_LIMIT_EXCEEDED',
        message: error.message,
      };
    }

    if (
      code.includes('failed') ||
      code.includes('bad') ||
      code.includes('malformed') ||
      code.includes('invalid')
    ) {
      return {
        code: 'SIMULATION_FAILED',
        message: error.message,
      };
    }

    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
    };
  }

  if (error instanceof NetworkError) {
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : 'Transaction submission failed';
  return { code: 'INTERNAL_ERROR', message };
}
