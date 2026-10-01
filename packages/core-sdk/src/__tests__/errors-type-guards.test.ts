import { describe, expect, it } from 'vitest';
import {
  isContractFailed,
  isInsufficientBalance,
  isInvalidSignature,
  isNetworkError,
  isRateLimitError,
} from '../errors';

describe('typed error guards', () => {
  const cases = [
    ['RATE_LIMIT', isRateLimitError],
    ['INSUFFICIENT_BALANCE', isInsufficientBalance],
    ['INVALID_SIGNATURE', isInvalidSignature],
    ['NETWORK_ERROR', isNetworkError],
    ['CONTRACT_FAILED', isContractFailed],
  ] as const;

  it.each(cases)('matches only the %s code', (code, guard) => {
    expect(guard({ code })).toBe(true);
    expect(guard({ code: 'OTHER_ERROR' })).toBe(false);
    expect(guard(new Error(code))).toBe(false);
    expect(guard(null)).toBe(false);
  });
});
