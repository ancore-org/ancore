import { describe, it, expect } from 'vitest';
import { validateSessionKeyPolicy } from '../validation';
import type { SessionKeyPolicy } from '@ancore/types';

describe('validateSessionKeyPolicy (#1539)', () => {
  const now = 1700000000000;

  it('should validate a valid SessionKeyPolicy', () => {
    const validPolicy: SessionKeyPolicy = {
      expiresAt: now + 86400000,
      permissions: 3,
      maxAmountPerCall: '1000',
      allowedContracts: ['CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
    };

    const res = validateSessionKeyPolicy(validPolicy, now);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('should reject expired session key', () => {
    const expiredPolicy: SessionKeyPolicy = {
      expiresAt: now - 1000,
      permissions: 1,
    };

    const res = validateSessionKeyPolicy(expiredPolicy, now);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Session key expiration must be in the future');
  });

  it('should reject non-positive maxAmountPerCall', () => {
    const invalidAmountPolicy: SessionKeyPolicy = {
      expiresAt: now + 3600000,
      permissions: 1,
      maxAmountPerCall: '-50',
    };

    const res = validateSessionKeyPolicy(invalidAmountPolicy, now);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('maxAmountPerCall must be a positive numeric value');
  });

  it('should reject invalid contract ID format in allowlist', () => {
    const invalidContractPolicy: SessionKeyPolicy = {
      expiresAt: now + 3600000,
      permissions: 1,
      allowedContracts: ['invalid-contract-id'],
    };

    const res = validateSessionKeyPolicy(invalidContractPolicy, now);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatch(/Invalid contract address in allowlist/);
  });
});
