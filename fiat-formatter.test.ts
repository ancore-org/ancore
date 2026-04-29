import { formatFiatAmount } from './fiat-formatter';

describe('formatFiatAmount', () => {
  it('formats USD with en-US locale by default', () => {
    expect(formatFiatAmount(1234.56)).toBe('$1,234.56');
  });

  it('formats EUR with de-DE locale', () => {
    const result = formatFiatAmount(1234.56, { currency: 'EUR', locale: 'de-DE' });
    // Handling potential non-breaking spaces that Intl.NumberFormat might insert depending on the Node version
    expect(result.replace(/\u00A0|\u202F/g, ' ')).toBe('1.234,56 €');
  });

  it('formats JPY with ja-JP locale and handles zero decimal rounding', () => {
    const result = formatFiatAmount(1234.56, { 
      currency: 'JPY', 
      locale: 'ja-JP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    expect(result).toBe('￥1,235'); // Rounds up due to half-expand rounding
  });

  it('formats GBP with en-GB locale', () => {
    expect(formatFiatAmount(1234.56, { currency: 'GBP', locale: 'en-GB' })).toBe('£1,234.56');
  });

  it('applies rounding rules correctly (half-expand)', () => {
    expect(formatFiatAmount(1.004)).toBe('$1.00');
    expect(formatFiatAmount(1.005)).toBe('$1.01');
  });

  it('falls back to en-US for invalid locale', () => {
    const result = formatFiatAmount(1234.56, { locale: 'invalid-locale' });
    expect(result).toBe('$1,234.56');
  });

  it('falls back to basic formatting for completely invalid inputs', () => {
    const result = formatFiatAmount(1234.56, { currency: 'INVALID_CURRENCY' });
    expect(result).toBe('1234.56 INVALID_CURRENCY');
  });
});