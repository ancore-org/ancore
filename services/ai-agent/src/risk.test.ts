import { scoreRisk } from './risk';
import type { DraftIntent } from './types';

function payment(
  amount: string,
  asset: 'XLM' | 'USDC' = 'XLM',
  destination = 'GDEST'
): DraftIntent {
  return { type: 'payment', amount, asset, destination };
}

describe('scoreRisk', () => {
  it('returns low risk for a small XLM payment', () => {
    const result = scoreRisk(payment('10'));
    expect(result.level).toBe('low');
    expect(result.reasons).toHaveLength(0);
  });

  it('returns medium risk for XLM >= 10000', () => {
    const result = scoreRisk(payment('10000'));
    expect(result.level).toBe('medium');
    expect(result.reasons.some((r) => r.includes('Large transfer'))).toBe(true);
  });

  it('returns high risk for XLM >= 100000', () => {
    const result = scoreRisk(payment('100000'));
    expect(result.level).toBe('high');
    expect(result.reasons.some((r) => r.includes('High-value'))).toBe(true);
  });

  it('returns medium risk for USDC >= 1000', () => {
    const result = scoreRisk(payment('1000', 'USDC'));
    expect(result.level).toBe('medium');
  });

  it('returns high risk for USDC >= 10000', () => {
    const result = scoreRisk(payment('10000', 'USDC'));
    expect(result.level).toBe('high');
  });

  it('flags first-time recipient when not in known set', () => {
    const result = scoreRisk(payment('10'), { knownRecipients: new Set(['GOTHER']) });
    expect(result.reasons.some((r) => r.includes('First-time'))).toBe(true);
  });

  it('does not flag known recipient', () => {
    const result = scoreRisk(payment('10', 'XLM', 'GDEST'), {
      knownRecipients: new Set(['GDEST']),
    });
    expect(result.reasons.some((r) => r.includes('First-time'))).toBe(false);
  });

  it('adds round-number reason for large round amounts', () => {
    const result = scoreRisk(payment('10000'));
    expect(result.reasons.some((r) => r.includes('Round number'))).toBe(true);
  });

  it('returns low risk for invoice intents', () => {
    const invoice: DraftIntent = {
      type: 'invoice',
      requestedBy: 'GCREQ',
      amount: '99999',
      asset: 'XLM',
    };
    const result = scoreRisk(invoice);
    expect(result.level).toBe('low');
    expect(result.reasons).toHaveLength(0);
  });
});
