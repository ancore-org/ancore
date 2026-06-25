import { NetworkError, SimulationFailedError, TransactionError } from '@ancore/stellar';
import { mapSubmissionError } from '../../src/services/mapSubmissionError';

describe('mapSubmissionError', () => {
  it('maps simulation errors to SIMULATION_FAILED', () => {
    const error = new SimulationFailedError('contract revert');
    expect(mapSubmissionError(error)).toEqual({
      code: 'SIMULATION_FAILED',
      message: 'contract revert',
    });
  });

  it('maps fee-related transaction errors to GAS_LIMIT_EXCEEDED', () => {
    const error = new TransactionError('Insufficient fee', { resultCode: 'tx_insufficient_fee' });
    expect(mapSubmissionError(error)).toEqual({
      code: 'GAS_LIMIT_EXCEEDED',
      message: 'Insufficient fee',
    });
  });

  it('maps failed transaction errors to SIMULATION_FAILED', () => {
    const error = new TransactionError('Contract failed', { resultCode: 'tx_failed' });
    expect(mapSubmissionError(error)).toEqual({
      code: 'SIMULATION_FAILED',
      message: 'Contract failed',
    });
  });

  it('maps network errors to INTERNAL_ERROR', () => {
    const error = new NetworkError('Horizon unreachable');
    expect(mapSubmissionError(error)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Horizon unreachable',
    });
  });

  it('maps unknown errors to INTERNAL_ERROR', () => {
    expect(mapSubmissionError(new Error('unexpected'))).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'unexpected',
    });
  });
});
