import { validateStellarAmount, getStellarAmountValidationError } from '../validation';

describe('validateStellarAmount', () => {
  describe('valid amounts', () => {
    it('accepts whole numbers', () => {
      expect(validateStellarAmount('10')).toBe(true);
      expect(validateStellarAmount('0')).toBe(true);
      expect(validateStellarAmount('1000')).toBe(true);
    });

    it('accepts amounts with up to 7 decimal places', () => {
      expect(validateStellarAmount('10.5')).toBe(true);
      expect(validateStellarAmount('10.1234567')).toBe(true);
      expect(validateStellarAmount('0.0000001')).toBe(true);
      expect(validateStellarAmount('9999999.9999999')).toBe(true);
    });

    it('accepts amounts with fewer than 7 decimal places', () => {
      expect(validateStellarAmount('10.1')).toBe(true);
      expect(validateStellarAmount('10.12')).toBe(true);
      expect(validateStellarAmount('10.123')).toBe(true);
      expect(validateStellarAmount('10.1234')).toBe(true);
      expect(validateStellarAmount('10.12345')).toBe(true);
      expect(validateStellarAmount('10.123456')).toBe(true);
    });

    it('accepts amounts with leading zeros', () => {
      expect(validateStellarAmount('0010')).toBe(true);
      expect(validateStellarAmount('0.5')).toBe(true);
      expect(validateStellarAmount('00.1234567')).toBe(true);
    });
  });

  describe('invalid amounts', () => {
    it('rejects negative numbers', () => {
      expect(validateStellarAmount('-10')).toBe(false);
      expect(validateStellarAmount('-0.5')).toBe(false);
      expect(validateStellarAmount('-100')).toBe(false);
    });

    it('rejects amounts with more than 7 decimal places', () => {
      expect(validateStellarAmount('10.12345678')).toBe(false);
      expect(validateStellarAmount('0.00000001')).toBe(false);
      expect(validateStellarAmount('1.123456789')).toBe(false);
    });

    it('rejects non-numeric characters', () => {
      expect(validateStellarAmount('abc')).toBe(false);
      expect(validateStellarAmount('10abc')).toBe(false);
      expect(validateStellarAmount('10.5abc')).toBe(false);
      expect(validateStellarAmount('$10')).toBe(false);
      expect(validateStellarAmount('10,5')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(validateStellarAmount('')).toBe(false);
    });

    it('rejects whitespace', () => {
      expect(validateStellarAmount(' ')).toBe(false);
      expect(validateStellarAmount(' 10')).toBe(false);
      expect(validateStellarAmount('10 ')).toBe(false);
      expect(validateStellarAmount('1 0')).toBe(false);
    });

    it('rejects special characters', () => {
      expect(validateStellarAmount('10+5')).toBe(false);
      expect(validateStellarAmount('10-5')).toBe(false);
      expect(validateStellarAmount('10*5')).toBe(false);
      expect(validateStellarAmount('10/5')).toBe(false);
    });

    it('rejects multiple decimal points', () => {
      expect(validateStellarAmount('10.5.5')).toBe(false);
      expect(validateStellarAmount('1.2.3.4')).toBe(false);
    });

    it('rejects decimal point without digits before or after', () => {
      expect(validateStellarAmount('.5')).toBe(false);
      expect(validateStellarAmount('10.')).toBe(false);
      expect(validateStellarAmount('.')).toBe(false);
    });

    it('rejects undefined and null', () => {
      expect(validateStellarAmount(undefined as any)).toBe(false);
      expect(validateStellarAmount(null as any)).toBe(false);
    });

    it('rejects non-string types', () => {
      expect(validateStellarAmount(10 as any)).toBe(false);
      expect(validateStellarAmount(10.5 as any)).toBe(false);
      expect(validateStellarAmount({} as any)).toBe(false);
      expect(validateStellarAmount([] as any)).toBe(false);
    });
  });

  describe('boundary cases', () => {
    it('accepts maximum stroop precision (7 decimals)', () => {
      expect(validateStellarAmount('0.0000001')).toBe(true);
      expect(validateStellarAmount('9999999999999999.9999999')).toBe(true);
    });

    it('rejects just over maximum stroop precision (8 decimals)', () => {
      expect(validateStellarAmount('0.00000001')).toBe(false);
      expect(validateStellarAmount('10.00000001')).toBe(false);
    });

    it('accepts zero with various formats', () => {
      expect(validateStellarAmount('0')).toBe(true);
      expect(validateStellarAmount('0.0')).toBe(true);
      expect(validateStellarAmount('0.0000000')).toBe(true);
    });
  });
});

describe('getStellarAmountValidationError', () => {
  it('returns appropriate error for empty input', () => {
    expect(getStellarAmountValidationError('')).toBe('Amount is required');
  });

  it('returns appropriate error for negative amounts', () => {
    expect(getStellarAmountValidationError('-10')).toBe('Negative amounts are not allowed');
    expect(getStellarAmountValidationError('-0.5')).toBe('Negative amounts are not allowed');
  });

  it('returns appropriate error for non-numeric characters', () => {
    expect(getStellarAmountValidationError('abc')).toBe(
      'Amount must contain only numbers and a decimal point'
    );
    expect(getStellarAmountValidationError('10abc')).toBe(
      'Amount must contain only numbers and a decimal point'
    );
  });

  it('returns appropriate error for multiple decimal points', () => {
    expect(getStellarAmountValidationError('10.5.5')).toBe(
      'Amount can have at most one decimal point'
    );
  });

  it('returns appropriate error for too many decimal places', () => {
    expect(getStellarAmountValidationError('10.12345678')).toBe('Maximum 7 decimal places allowed');
    expect(getStellarAmountValidationError('0.00000001')).toBe('Maximum 7 decimal places allowed');
  });

  it('returns generic error for other invalid formats', () => {
    expect(getStellarAmountValidationError('.5')).toBe('Invalid amount format');
    expect(getStellarAmountValidationError('10.')).toBe('Invalid amount format');
  });

  it('does not return error for valid amounts', () => {
    expect(getStellarAmountValidationError('10')).toBe('Invalid amount format');
    expect(getStellarAmountValidationError('10.5')).toBe('Invalid amount format');
    expect(getStellarAmountValidationError('10.1234567')).toBe('Invalid amount format');
  });
});
