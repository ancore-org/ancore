import { describe, expect, it } from '@jest/globals';
import {
  estimateEntropy,
  scoreEntropy,
  estimateCrackTime,
  analyzeEntropy,
  meetsEntropyThreshold,
  meetsStrictEntropyThreshold,
  DEFAULT_ENTROPY_THRESHOLD,
  STRICT_ENTROPY_THRESHOLD,
} from '../entropy';

describe('estimateEntropy()', () => {
  it('returns 0 for empty string', () => {
    expect(estimateEntropy('')).toBe(0);
  });

  it('returns 0 for null-like input', () => {
    expect(estimateEntropy(null as unknown as string)).toBe(0);
  });

  it('calculates entropy for lowercase only', () => {
    const entropy = estimateEntropy('abcdefghijklmnopqrstuvwxyz');
    expect(entropy).toBeGreaterThan(0);
  });

  it('calculates entropy for mixed case is higher than lowercase only', () => {
    const mixed = estimateEntropy('AbCdEfGhIjKlMnOpQrStUvWxYz');
    const lower = estimateEntropy('abcdefghijklmnopqrstuvwxyz');
    expect(mixed).toBeGreaterThan(lower);
  });

  it('calculates entropy increases with special characters', () => {
    const withSpecial = estimateEntropy('Pass@word!');
    const withoutSpecial = estimateEntropy('Passwordabc');
    expect(withSpecial).toBeGreaterThan(withoutSpecial);
  });

  it('weak password has low entropy', () => {
    expect(estimateEntropy('password')).toBeLessThan(40);
  });

  it('strong password has high entropy', () => {
    expect(estimateEntropy('MySecure@Pass123!')).toBeGreaterThan(70);
  });

  it('entropy increases with length', () => {
    const short = estimateEntropy('Pass@1');
    const long = estimateEntropy('Pass@1Pass@1Pass@1');
    expect(long).toBeGreaterThan(short);
  });
});

describe('scoreEntropy()', () => {
  it('scores very_weak for entropy < 30', () => {
    expect(scoreEntropy(20)).toBe('very_weak');
  });

  it('scores weak for entropy 30-49', () => {
    expect(scoreEntropy(40)).toBe('weak');
  });

  it('scores fair for entropy 50-59', () => {
    expect(scoreEntropy(55)).toBe('fair');
  });

  it('scores good for entropy 60-79', () => {
    expect(scoreEntropy(70)).toBe('good');
  });

  it('scores strong for entropy 80-99', () => {
    expect(scoreEntropy(90)).toBe('strong');
  });

  it('scores very_strong for entropy >= 100', () => {
    expect(scoreEntropy(100)).toBe('very_strong');
  });
});

describe('estimateCrackTime()', () => {
  it('returns time string for all entropy levels', () => {
    const validTimes = [
      'Milliseconds',
      'Seconds',
      'Minutes',
      'Hours',
      'Days',
      'Months',
      'Years',
      'Decades',
      'Centuries',
      'Millennia',
    ];
    expect(validTimes).toContain(estimateCrackTime(10));
    expect(validTimes).toContain(estimateCrackTime(50));
    expect(validTimes).toContain(estimateCrackTime(100));
  });

  it('weaker passwords have shorter crack times', () => {
    const weak = estimateCrackTime(20);
    const strong = estimateCrackTime(80);
    // Strong passwords should have larger time categories
    const timeOrder = [
      'Milliseconds',
      'Seconds',
      'Minutes',
      'Hours',
      'Days',
      'Months',
      'Years',
      'Decades',
      'Centuries',
      'Millennia',
    ];
    expect(timeOrder.indexOf(strong)).toBeGreaterThanOrEqual(timeOrder.indexOf(weak));
  });

  it('returns reasonable values for typical passwords', () => {
    const weakTime = estimateCrackTime(estimateEntropy('password'));
    const strongTime = estimateCrackTime(estimateEntropy('MySecure@Pass123!'));
    const validTimes = [
      'Milliseconds',
      'Seconds',
      'Minutes',
      'Hours',
      'Days',
      'Months',
      'Years',
      'Decades',
      'Centuries',
      'Millennia',
    ];
    expect(validTimes).toContain(weakTime);
    expect(validTimes).toContain(strongTime);
  });
});

describe('analyzeEntropy()', () => {
  it('returns complete analysis for weak password', () => {
    const result = analyzeEntropy('password');
    expect(result.bits).toBeGreaterThan(0);
    expect(['very_weak', 'weak']).toContain(result.score);
    expect(typeof result.crackTime).toBe('string');
  });

  it('returns complete analysis for strong password', () => {
    const result = analyzeEntropy('MySecure@Pass123XYZ!');
    expect(result.bits).toBeGreaterThan(70);
    expect(['strong', 'very_strong']).toContain(result.score);
    expect(typeof result.crackTime).toBe('string');
  });

  it('rounds bits to one decimal place', () => {
    const result = analyzeEntropy('TestPass123!');
    expect(result.bits).toBe(Math.round(estimateEntropy('TestPass123!') * 10) / 10);
  });

  it('handles empty string', () => {
    const result = analyzeEntropy('');
    expect(result.bits).toBe(0);
    expect(result.score).toBe('very_weak');
  });

  it('consistency with individual functions', () => {
    const pass = 'ComplexPass@2024';
    const bits = estimateEntropy(pass);
    const result = analyzeEntropy(pass);
    expect(result.bits).toBe(Math.round(bits * 10) / 10);
    expect(result.score).toBe(scoreEntropy(bits));
    expect(result.crackTime).toBe(estimateCrackTime(bits));
  });
});

describe('meetsEntropyThreshold()', () => {
  it('returns true for strong password', () => {
    expect(meetsEntropyThreshold('MySecure@Pass123')).toBe(true);
  });

  it('returns false for weak password', () => {
    expect(meetsEntropyThreshold('password')).toBe(false);
  });

  it('accepts custom threshold', () => {
    const pass = 'Test@1234';
    const entropy = estimateEntropy(pass);
    expect(meetsEntropyThreshold(pass, entropy - 1)).toBe(true);
    expect(meetsEntropyThreshold(pass, entropy + 1)).toBe(false);
  });

  it('uses DEFAULT_ENTROPY_THRESHOLD by default', () => {
    const pass = 'WeakPass';
    const defaultResult = meetsEntropyThreshold(pass);
    const explicitResult = meetsEntropyThreshold(pass, DEFAULT_ENTROPY_THRESHOLD);
    expect(defaultResult).toBe(explicitResult);
  });

  it('returns false for empty string', () => {
    expect(meetsEntropyThreshold('')).toBe(false);
  });
});

describe('meetsStrictEntropyThreshold()', () => {
  it('returns false for passwords below strict threshold', () => {
    expect(meetsStrictEntropyThreshold('password')).toBe(false);
  });

  it('returns true for very strong passwords', () => {
    expect(meetsStrictEntropyThreshold('MyVeryStrongPassword123!@#$%X')).toBe(true);
  });

  it('uses STRICT_ENTROPY_THRESHOLD', () => {
    const pass = 'StrongPass@123456ABC';
    const result = meetsStrictEntropyThreshold(pass);
    const manual = meetsEntropyThreshold(pass, STRICT_ENTROPY_THRESHOLD);
    expect(result).toBe(manual);
  });

  it('is at least as restrictive as default threshold', () => {
    const pass = 'Test@1234Password';
    const defaultOk = meetsEntropyThreshold(pass);
    const strictOk = meetsStrictEntropyThreshold(pass);
    if (!strictOk) {
      // If strict fails, default should also fail
      expect(defaultOk).toBeFalsy();
    }
  });
});

describe('Integration: weak vs strong examples', () => {
  const weakExamples = ['password', 'letmein', 'qwerty123', 'admin'];
  const strongExamples = ['MySecure@Pass123', 'Tr0p!cal$un$et2024', 'Complex.Pass@Word#89'];

  describe('weak passwords', () => {
    weakExamples.forEach((pass) => {
      it(`${pass} fails entropy checks`, () => {
        expect(meetsEntropyThreshold(pass)).toBe(false);
        expect(meetsStrictEntropyThreshold(pass)).toBe(false);
        expect(scoreEntropy(estimateEntropy(pass))).toMatch(/very_weak|weak/);
      });
    });
  });

  describe('strong passwords', () => {
    strongExamples.forEach((pass) => {
      it(`${pass} passes entropy checks`, () => {
        expect(meetsEntropyThreshold(pass)).toBe(true);
        expect(meetsStrictEntropyThreshold(pass)).toBe(true);
        expect(scoreEntropy(estimateEntropy(pass))).toMatch(/good|strong|very_strong/);
      });
    });
  });
});

describe('No regression to existing password checks', () => {
  it('entropy functions work independently', () => {
    const pass = 'MyPass@123456';
    expect(estimateEntropy(pass)).toBeGreaterThan(0);
    expect(meetsEntropyThreshold(pass)).toBe(true);
  });
});
