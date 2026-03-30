import { describe, expect, it } from 'vitest';
import { validateAmount, validateRecipientAddress } from '@/hooks/useSendTransaction';

describe('useSendTransaction validation', () => {
  it('rejects invalid recipient addresses', () => {
    expect(validateRecipientAddress('')).toBe('Recipient address is required');
    expect(validateRecipientAddress('G123')).toBe('Invalid Stellar address');
  });

  it('accepts a valid stellar address', () => {
    const valid = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    expect(validateRecipientAddress(valid)).toBeUndefined();
  });

  it('rejects invalid amounts', () => {
    expect(validateAmount('', 100)).toBe('Amount is required');
    expect(validateAmount('0', 100)).toBe('Amount must be greater than zero');
    expect(validateAmount('100.12345678', 200)).toBe('Too many decimal places (max 7)');
  });

  it('rejects overspending and accepts safe amount', () => {
    expect(validateAmount('15', 10)).toBe('Insufficient balance');
    expect(validateAmount('9.5', 10)).toBeUndefined();
  });
});
