import { scoreRisk } from './risk';
import type { DraftIntent } from './types';
import {
  CHECKSUM_INVALID_ADDRESS,
  NON_BASE32_ADDRESS,
  OTHER_VALID_ADDRESS,
  UNRESOLVABLE_HANDLE,
  VALID_ADDRESS,
} from './__tests__/fixtures/addresses';

function payment(
  amount: string,
  asset: 'XLM' | 'USDC' = 'XLM',
  destination = VALID_ADDRESS
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
    const result = scoreRisk(payment('10'), { knownRecipients: new Set([OTHER_VALID_ADDRESS]) });
    expect(result.reasons.some((r) => r.includes('First-time'))).toBe(true);
  });

  it('does not flag known recipient', () => {
    const result = scoreRisk(payment('10', 'XLM', VALID_ADDRESS), {
      knownRecipients: new Set([VALID_ADDRESS]),
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
      requestedBy: OTHER_VALID_ADDRESS,
      amount: '99999',
      asset: 'XLM',
    };
    const result = scoreRisk(invoice);
    expect(result.level).toBe('low');
    expect(result.reasons).toHaveLength(0);
  });

  // Issue #1210 — a destination that is not a usable address gets its own
  // signal. Reaching scoreRisk() at all means the schema and resolution layers
  // were bypassed (e.g. /v1/intents/validate, which scores structurally valid
  // input with no resolver available), so this is the last line of defence.
  describe('invalid recipient signal', () => {
    const invalidDestinations: ReadonlyArray<readonly [string, string]> = [
      ['a checksum-invalid address', CHECKSUM_INVALID_ADDRESS],
      ['a non-base32 lookalike', NON_BASE32_ADDRESS],
      ['an unresolved @handle', UNRESOLVABLE_HANDLE],
      ['a bare display name', 'Bob'],
    ];

    it.each(invalidDestinations)('flags %s as an invalid recipient', (_label, destination) => {
      const result = scoreRisk(payment('10', 'XLM', destination));
      expect(result.reasons.some((r) => r.startsWith('Invalid recipient'))).toBe(true);
    });

    it.each(invalidDestinations)('scores %s as high risk', (_label, destination) => {
      const result = scoreRisk(payment('10', 'XLM', destination));
      expect(result.level).toBe('high');
    });

    // The Gate 0 4c decision: the two signals are mutually exclusive. A
    // malformed destination is unusable, not merely unfamiliar, and emitting
    // both would bury it in the same medium bucket as a legitimate new payee.
    it('emits the invalid-recipient signal INSTEAD OF first-time recipient', () => {
      const result = scoreRisk(payment('10', 'XLM', CHECKSUM_INVALID_ADDRESS), {
        knownRecipients: new Set([VALID_ADDRESS]),
      });

      expect(result.reasons.some((r) => r.startsWith('Invalid recipient'))).toBe(true);
      expect(result.reasons.some((r) => r.includes('First-time'))).toBe(false);
    });

    it('still emits first-time recipient for a valid but unknown address', () => {
      const result = scoreRisk(payment('10', 'XLM', OTHER_VALID_ADDRESS), {
        knownRecipients: new Set([VALID_ADDRESS]),
      });

      expect(result.reasons.some((r) => r.includes('First-time'))).toBe(true);
      expect(result.reasons.some((r) => r.startsWith('Invalid recipient'))).toBe(false);
      // Unfamiliar is medium; unusable is high. The two must stay separable.
      expect(result.level).toBe('medium');
    });

    it('does not flag a valid address that is a known recipient', () => {
      const result = scoreRisk(payment('10', 'XLM', VALID_ADDRESS), {
        knownRecipients: new Set([VALID_ADDRESS]),
      });

      expect(result.reasons).toHaveLength(0);
      expect(result.level).toBe('low');
    });
  });
});
