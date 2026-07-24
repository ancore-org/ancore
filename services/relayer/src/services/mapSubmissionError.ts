import { NetworkError, SimulationFailedError, TransactionError } from '@ancore/stellar';
import type { RelayError } from '../types';
import { RelayErrorCodes } from '../types/errorCodes';

const RPC_DOWN_PATTERN =
  /econnrefused|econnreset|etimedout|enotfound|eai_again|fetch failed|socket hang up|unreachable|timed? ?out|bad gateway|service unavailable|\b50[234]\b|rpc (error|down|failure)/i;

function isRpcDownMessage(message: string): boolean {
  return RPC_DOWN_PATTERN.test(message);
}

/**
 * Map Stellar network / submission errors to typed relay error responses.
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

  if (error instanceof NetworkError) {
    return {
      code: RelayErrorCodes.RPC_DOWN,
      message: error.message,
    };
  }

  const message = error instanceof Error ? error.message : 'Transaction submission failed';
  if (isRpcDownMessage(message)) {
    return { code: RelayErrorCodes.RPC_DOWN, message };
  }
  return { code: RelayErrorCodes.INTERNAL_ERROR, message };
}
