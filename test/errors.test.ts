import { describe, it, expect } from 'vitest';
import {
  AncoreError,
  isAncoreError,
  isRateLimitError,
  isInsufficientBalanceError,
  isUnauthorizedError,
  isValidationError,
} from '../src/errors';

describe('Error Type Guards', () => {
  it('identifies AncoreError instances and plain error objects', () => {
    const errInstance = new AncoreError({ status: 400, code: 'VALIDATION_ERROR', message: 'Bad request' });
    const errPlain = { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' };
    const notAnError = { foo: 'bar' };

    expect(isAncoreError(errInstance)).toBe(true);
    expect(isAncoreError(errPlain)).toBe(true);
    expect(isAncoreError({ status: 429, code: 'RATE_LIMIT_EXCEEDED' })).toBe(false);
    expect(isAncoreError(notAnError)).toBe(false);
    expect(isAncoreError(null)).toBe(false);
  });

  it('correctly identifies rate limit errors', () => {
    const err = new AncoreError({ status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit' });
    expect(isRateLimitError(err)).toBe(true);
    expect(isRateLimitError({ status: 429, code: 'OTHER', message: '' })).toBe(true);
    expect(isRateLimitError(new Error('generic'))).toBe(false);
  });

  it('correctly identifies insufficient balance errors', () => {
    const err = new AncoreError({ status: 402, code: 'INSUFFICIENT_BALANCE', message: 'Low balance' });
    expect(isInsufficientBalanceError(err)).toBe(true);
    expect(isInsufficientBalanceError(new Error('generic'))).toBe(false);
  });

  it('correctly identifies unauthorized errors', () => {
    const err = new AncoreError({ status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' });
    expect(isUnauthorizedError(err)).toBe(true);
    expect(isUnauthorizedError(new Error('generic'))).toBe(false);
  });

  it('correctly identifies validation errors', () => {
    const err = new AncoreError({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid' });
    expect(isValidationError(err)).toBe(true);
    expect(isValidationError(new Error('generic'))).toBe(false);
  });
});
