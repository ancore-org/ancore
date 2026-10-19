import { formatFeeWithStroops, xlmToStroops, STROOPS_PER_XLM } from '../formatters';

describe('formatters', () => {
  describe('STROOPS_PER_XLM constant', () => {
    it('equals 10,000,000 stroops per 1 XLM', () => {
      expect(STROOPS_PER_XLM).toBe(10_000_000);
    });
  });

  describe('xlmToStroops', () => {
    it('converts decimal XLM to stroops accurately', () => {
      expect(xlmToStroops(1)).toBe(10_000_000);
      expect(xlmToStroops('1')).toBe(10_000_000);
      expect(xlmToStroops('0.0000100')).toBe(100);
      expect(xlmToStroops('0.0001')).toBe(1000);
      expect(xlmToStroops('0.0000600')).toBe(600);
      expect(xlmToStroops(0.00001)).toBe(100);
    });

    it('handles zero or invalid inputs gracefully', () => {
      expect(xlmToStroops(0)).toBe(0);
      expect(xlmToStroops('0')).toBe(0);
      expect(xlmToStroops('invalid')).toBe(0);
      expect(xlmToStroops(-1)).toBe(0);
    });
  });

  describe('formatFeeWithStroops', () => {
    it('formats standard fee strings with both XLM and stroops', () => {
      expect(formatFeeWithStroops('0.0000100')).toBe('0.0000100 XLM (100 stroops)');
      expect(formatFeeWithStroops('0.0001')).toBe('0.0001 XLM (1000 stroops)');
      expect(formatFeeWithStroops('0.0000600')).toBe('0.0000600 XLM (600 stroops)');
    });

    it('handles numeric fee inputs', () => {
      expect(formatFeeWithStroops(0.00001)).toBe('0.00001 XLM (100 stroops)');
      expect(formatFeeWithStroops(1)).toBe('1 XLM (10000000 stroops)');
    });

    it('handles inputs already suffixed with XLM', () => {
      expect(formatFeeWithStroops('0.0000100 XLM')).toBe('0.0000100 XLM (100 stroops)');
      expect(formatFeeWithStroops('0.0001 xlm')).toBe('0.0001 XLM (1000 stroops)');
    });

    it('handles zero fees cleanly', () => {
      expect(formatFeeWithStroops('0')).toBe('0 XLM (0 stroops)');
      expect(formatFeeWithStroops(0)).toBe('0 XLM (0 stroops)');
      expect(formatFeeWithStroops('0.0000000')).toBe('0.0000000 XLM (0 stroops)');
      expect(formatFeeWithStroops(null)).toBe('0 XLM (0 stroops)');
      expect(formatFeeWithStroops(undefined)).toBe('0 XLM (0 stroops)');
      expect(formatFeeWithStroops('')).toBe('0 XLM (0 stroops)');
    });

    it('handles sub-stroop fractional amounts cleanly', () => {
      // 0.00000005 XLM = 0.5 stroops
      expect(formatFeeWithStroops('0.00000005')).toBe('0.00000005 XLM (0.5 stroops)');
      // 0.000000025 XLM = 0.25 stroops
      expect(formatFeeWithStroops('0.000000025')).toBe('0.000000025 XLM (0.25 stroops)');
    });
  });
});
