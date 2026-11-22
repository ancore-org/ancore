import { NetworkError, SimulationFailedError, TransactionError } from '@ancore/stellar';
import { mapSubmissionError } from '../../src/services/mapSubmissionError';
import { RelayErrorCodes } from '../../src/types';

describe('mapSubmissionError', () => {
  it('maps simulation errors to SIMULATION_FAILED', () => {
    const error = new SimulationFailedError('contract revert');
    expect(mapSubmissionError(error)).toEqual({
      code: RelayErrorCodes.SIMULATION_FAILED,
      message: 'contract revert',
    });
  });

  it('maps fee-related transaction errors to GAS_LIMIT_EXCEEDED', () => {
    for (const resultCode of ['tx_insufficient_fee', 'tx_insufficient_balance', 'BudgetExceeded']) {
      const error = new TransactionError('Insufficient resources to submit transaction', { resultCode });
      expect(mapSubmissionError(error)).toEqual({
        code: RelayErrorCodes.GAS_LIMIT_EXCEEDED,
        message: 'Insufficient resources to submit transaction',
      });
    }
  });

  it.each(['tx_failed', 'tx_bad_auth', 'tx_bad_seq'])(
    'maps transaction result %s to SIMULATION_FAILED',
    (resultCode) => {
      const error = new TransactionError(`Submission failed: ${resultCode}`, { resultCode });
      expect(mapSubmissionError(error)).toEqual({
        code: RelayErrorCodes.SIMULATION_FAILED,
        message: `Submission failed: ${resultCode}`,
      });
    }
  );

  it('maps transaction errors with unrecognized result codes to INTERNAL_ERROR', () => {
    const error = new TransactionError('Internal transaction failure', {
      resultCode: 'tx_internal_error',
    });
    expect(mapSubmissionError(error)).toEqual({
      code: RelayErrorCodes.INTERNAL_ERROR,
      message: 'Internal transaction failure',
    });
  });

  it('maps network errors to RPC_DOWN', () => {
    const error = new NetworkError('Horizon unreachable');
    expect(mapSubmissionError(error)).toEqual({
      code: RelayErrorCodes.RPC_DOWN,
      message: 'Horizon unreachable',
    });
  });

  it('maps unknown Error instances to INTERNAL_ERROR without throwing', () => {
    expect(mapSubmissionError(new Error('unexpected'))).toEqual({
      code: RelayErrorCodes.INTERNAL_ERROR,
      message: 'unexpected',
    });
  });

  it('returns a valid fallback envelope for unknown strings and values', () => {
    expect(mapSubmissionError('unknown submission failure')).toEqual({
      code: RelayErrorCodes.INTERNAL_ERROR,
      message: 'Transaction submission failed',
    });
    expect(mapSubmissionError({ unexpected: true })).toEqual({
      code: RelayErrorCodes.INTERNAL_ERROR,
      message: 'Transaction submission failed',
    });
  });
});
