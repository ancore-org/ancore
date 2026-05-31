import { mapSimulationError } from '../../src/services/mapSimulationError';

describe('mapSimulationError', () => {
  it('maps host function simulation failures to SIMULATION_FAILED', () => {
    const result = mapSimulationError(new Error('host_function_failed: trap'));
    expect(result).toEqual({
      code: 'SIMULATION_FAILED',
      message: 'host_function_failed: trap',
    });
  });

  it('maps insufficient-balance simulation errors to SIMULATION_FAILED', () => {
    const result = mapSimulationError(new Error('Insufficient balance for invocation'));
    expect(result).toEqual({
      code: 'SIMULATION_FAILED',
      message: 'Insufficient balance for invocation',
    });
  });

  it('maps resource budget exhaustion to GAS_LIMIT_EXCEEDED', () => {
    const result = mapSimulationError(new Error('Resource budget exceeded'));
    expect(result).toEqual({
      code: 'GAS_LIMIT_EXCEEDED',
      message: 'Resource budget exceeded',
    });
  });

  it('returns null for errors that are not simulation-shaped', () => {
    expect(mapSimulationError(new Error('Horizon unreachable'))).toBeNull();
    expect(mapSimulationError(undefined)).toBeNull();
    expect(mapSimulationError({})).toBeNull();
  });

  it('extracts messages from plain strings and message-bearing objects', () => {
    expect(mapSimulationError('simulation failed: trap')).toEqual({
      code: 'SIMULATION_FAILED',
      message: 'simulation failed: trap',
    });
    expect(mapSimulationError({ message: 'simulate panic' })).toEqual({
      code: 'SIMULATION_FAILED',
      message: 'simulate panic',
    });
  });
});
