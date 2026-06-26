/**
 * Public surface test: SimulationResult and SimulationError must be importable
 * directly from the package index without casting to `any`.
 */

import type { SimulationResult, SimulationError } from '../index';

describe('SimulationResult public type', () => {
  it('accepts a minimal result with required fields', () => {
    const result: SimulationResult = {
      fee: '100',
      operationCount: 1,
    };
    expect(result.fee).toBe('100');
    expect(result.operationCount).toBe(1);
  });

  it('accepts optional fields', () => {
    const result: SimulationResult = {
      fee: '500',
      operationCount: 2,
      minResourceFee: '100',
    };
    expect(result.minResourceFee).toBe('100');
  });
});

describe('SimulationError public type', () => {
  it('accepts an error-only shape', () => {
    const err: SimulationError = { error: 'Host function failure' };
    expect(err.error).toBe('Host function failure');
  });

  it('accepts a message-only shape', () => {
    const err: SimulationError = { message: 'simulation timed out' };
    expect(err.message).toBe('simulation timed out');
  });

  it('accepts an empty object (all fields optional)', () => {
    const err: SimulationError = {};
    expect(err).toBeDefined();
  });
});
