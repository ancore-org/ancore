import { describe, it, expect } from 'vitest';
import {
  validateShares,
  parseDecimal,
  formatAmount,
  amountsEqual,
  errorsByKey,
  formError,
  PERCENTAGE_TOTAL,
  type ShareInput,
} from '../split-bill-validation';

function shares(...values: string[]): ShareInput[] {
  return values.map((share, index) => ({ key: `p${index}`, share }));
}

describe('parseDecimal', () => {
  it('parses plain and decimal numbers', () => {
    expect(parseDecimal('10')).toBe(10);
    expect(parseDecimal('10.5')).toBe(10.5);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('  33.33  ')).toBe(33.33);
  });

  it('rejects blank and non-numeric input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('10abc')).toBeNull();
    expect(parseDecimal('1,000')).toBeNull();
  });

  it('rejects values Number() would silently accept', () => {
    expect(parseDecimal('Infinity')).toBeNull();
    expect(parseDecimal('NaN')).toBeNull();
    expect(parseDecimal('1e5')).toBeNull();
    expect(parseDecimal('0x10')).toBeNull();
  });

  it('parses negative numbers so the caller can reject them with a clear message', () => {
    expect(parseDecimal('-5')).toBe(-5);
  });
});

describe('formatAmount', () => {
  it('trims trailing zeros', () => {
    expect(formatAmount(10)).toBe('10');
    expect(formatAmount(10.5)).toBe('10.5');
    expect(formatAmount(0.1)).toBe('0.1');
  });

  it('clamps to Stellar 7-decimal precision', () => {
    expect(formatAmount(1 / 3)).toBe('0.3333333');
  });
});

describe('amountsEqual', () => {
  it('treats binary floating-point drift as equal', () => {
    expect(amountsEqual(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('still separates values that differ at Stellar precision', () => {
    expect(amountsEqual(0.0000001, 0.0000002)).toBe(false);
  });
});

describe('validateShares — percentage mode', () => {
  it('accepts shares summing to exactly 100%', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('50', '30', '20'),
      totalAmount: '200',
    });

    expect(result.valid).toBe(true);
    expect(result.sum).toBe(PERCENTAGE_TOTAL);
    expect(result.amounts).toEqual({ p0: '100', p1: '60', p2: '40' });
  });

  it('rejects shares that fall short of 100%', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('50', '30'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toContain('20% short of 100%');
  });

  it('rejects shares that exceed 100%', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('60', '60'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toContain('20% over 100%');
  });

  it('requires a bill total so percentages can be converted', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('50', '50'),
      totalAmount: '',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toContain('Enter the bill total');
  });

  it('rejects a single share above 100%', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('150', '10'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(errorsByKey(result.errors).p0).toBe('Share cannot exceed 100%.');
  });

  it('accepts a single participant taking the whole bill', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('100'),
      totalAmount: '75.25',
    });

    expect(result.valid).toBe(true);
    expect(result.amounts.p0).toBe('75.25');
  });

  it('folds the rounding remainder into the last participant', () => {
    // 100 / 3 is not representable at 7 decimals, so naive rounding would
    // leave the parts summing to 99.9999999 rather than 100.
    const result = validateShares({
      mode: 'percentage',
      participants: shares('33.3333333', '33.3333333', '33.3333334'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(true);

    const total = Object.values(result.amounts).reduce((acc, a) => acc + Number(a), 0);
    expect(amountsEqual(total, 100)).toBe(true);
  });

  it('accepts fractional percentages that still total 100', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('33.5', '33.25', '33.25'),
      totalAmount: '400',
    });

    expect(result.valid).toBe(true);
    expect(result.amounts).toEqual({ p0: '134', p1: '133', p2: '133' });
  });
});

describe('validateShares — amount mode', () => {
  it('accepts amounts summing to the stated total', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('40', '35', '25'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(true);
    expect(result.sum).toBe(100);
    expect(result.amounts).toEqual({ p0: '40', p1: '35', p2: '25' });
  });

  it('rejects amounts under the total', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('40', '35'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toContain('25 short of the 100 total');
  });

  it('rejects amounts over the total', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('80', '35'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toContain('15 over the 100 total');
  });

  it('skips the sum check when no total is given', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('40', '35'),
      totalAmount: '',
    });

    expect(result.valid).toBe(true);
    expect(result.sum).toBe(75);
  });

  it('tolerates floating-point drift at Stellar precision', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('0.1', '0.2'),
      totalAmount: '0.3',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects a total that is not a number', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('40', '60'),
      totalAmount: 'one hundred',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toBe('Total amount must be a number.');
  });

  it('rejects a zero or negative total', () => {
    for (const totalAmount of ['0', '-100']) {
      const result = validateShares({
        mode: 'amount',
        participants: shares('40', '60'),
        totalAmount,
      });

      expect(result.valid).toBe(false);
      expect(formError(result.errors)).toBe('Total amount must be greater than zero.');
    }
  });
});

describe('validateShares — per-participant errors', () => {
  it('flags blank shares on the row that is blank', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('40', ''),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(errorsByKey(result.errors)).toEqual({
      p1: 'Enter an amount for this participant.',
    });
  });

  it('flags zero and negative shares', () => {
    const result = validateShares({
      mode: 'amount',
      participants: shares('0', '-5'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(errorsByKey(result.errors).p0).toContain('greater than zero');
    expect(errorsByKey(result.errors).p1).toContain('greater than zero');
  });

  it('suppresses the sum error while a row is still invalid', () => {
    // Reporting "doesn't add up" alongside "this field is empty" is noise —
    // the sum cannot be meaningful until every row parses.
    const result = validateShares({
      mode: 'percentage',
      participants: shares('50', ''),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toBeNull();
  });

  it('rejects an empty participant list', () => {
    const result = validateShares({
      mode: 'amount',
      participants: [],
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(formError(result.errors)).toBe('Add at least one participant.');
  });

  it('returns no resolved amounts when validation fails', () => {
    const result = validateShares({
      mode: 'percentage',
      participants: shares('50', '40'),
      totalAmount: '100',
    });

    expect(result.valid).toBe(false);
    expect(result.amounts).toEqual({});
  });
});

describe('errorsByKey', () => {
  it('keeps the first error per row and drops form-level errors', () => {
    const byKey = errorsByKey([
      { key: 'p0', message: 'first' },
      { key: 'p0', message: 'second' },
      { key: null, message: 'form' },
    ]);

    expect(byKey).toEqual({ p0: 'first' });
  });
});
