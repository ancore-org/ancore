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

  it('maps network errors to RPC_DOWN', () => {
    const error = new NetworkError('Horizon unreachable');
    expect(mapSubmissionError(error)).toEqual({
      code: 'RPC_DOWN',
      message: 'Horizon unreachable',
    });
  });

  it('maps network-shaped generic errors to RPC_DOWN', () => {
    expect(mapSubmissionError(new Error('fetch failed'))).toEqual({
      code: 'RPC_DOWN',
      message: 'fetch failed',
    });
    expect(mapSubmissionError(new Error('connect ECONNREFUSED 127.0.0.1:8000'))).toEqual({
      code: 'RPC_DOWN',
      message: 'connect ECONNREFUSED 127.0.0.1:8000',
    });
  });

  it('maps unknown errors to INTERNAL_ERROR', () => {
    expect(mapSubmissionError(new Error('unexpected'))).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'unexpected',
    });
  });
});
