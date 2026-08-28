import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ASSET_CODE,
  formatAssetAmount,
  formatAssetAmountValue,
} from '../format-asset-amount';

describe('formatAssetAmountValue', () => {
  it('renders whole and short decimal amounts without padding', () => {
    expect(formatAssetAmountValue(10)).toBe('10');
    expect(formatAssetAmountValue(142.5)).toBe('142.5');
  });

  it('keeps all seven Stellar decimal places', () => {
    expect(formatAssetAmountValue(0.0000001)).toBe('0.0000001');
    expect(formatAssetAmountValue(1.2345678)).toBe('1.2345678');
  });

  it('groups the integer part but not the fraction', () => {
    expect(formatAssetAmountValue(1234567.891)).toBe('1,234,567.891');
  });

  it('returns a placeholder for non-finite amounts', () => {
    expect(formatAssetAmountValue(Number.NaN)).toBe('—');
    expect(formatAssetAmountValue(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatAssetAmount', () => {
  it('appends the transaction asset code', () => {
    expect(formatAssetAmount(142.5, 'USDC')).toBe('142.5 USDC');
  });

  it('never renders a currency symbol', () => {
    expect(formatAssetAmount(142.5, 'USDC')).not.toContain('$');
  });

  it('falls back to XLM when no asset code is present', () => {
    expect(formatAssetAmount(142.5)).toBe(`142.5 ${DEFAULT_ASSET_CODE}`);
    expect(formatAssetAmount(142.5, null)).toBe(`142.5 ${DEFAULT_ASSET_CODE}`);
    expect(formatAssetAmount(142.5, '  ')).toBe(`142.5 ${DEFAULT_ASSET_CODE}`);
  });

  it('does not truncate sub-cent precision the way toFixed(2) did', () => {
    expect(formatAssetAmount(0.0000123, 'XLM')).toBe('0.0000123 XLM');
  });
});
