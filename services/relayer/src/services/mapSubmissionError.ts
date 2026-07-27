import { NetworkError, SimulationFailedError, TransactionError } from '@ancore/stellar';
import type { RelayError } from '../types';
import { RelayErrorCodes } from '../types';

/**
 * Map Stellar network / submission errors to typed relay error responses.
 *
 * Every branch resolves to a {@link RelayErrorCodes} member so callers can
 * switch on `error.code` rather than parsing `error.message`.
 */
export function mapSubmissionError(error: unknown): RelayError {
  if (error instanceof SimulationFailedError) {
    return {
      code: RelayErrorCodes.SIMULATION_FAILED,
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
        code: RelayErrorCodes.GAS_LIMIT_EXCEEDED,
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
        code: RelayErrorCodes.SIMULATION_FAILED,
        message: error.message,
      };
    }

    return {
      code: RelayErrorCodes.INTERNAL_ERROR,
      message: error.message,
    };
  }

  // The upstream Horizon / Soroban RPC endpoint could not be reached. This is
  // retryable from the client's perspective, which is why it is distinct from
  // INTERNAL_ERROR.
  if (error instanceof NetworkError) {
    return {
      code: RelayErrorCodes.RPC_DOWN,
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : 'Transaction submission failed';
  return { code: RelayErrorCodes.INTERNAL_ERROR, message };
}
