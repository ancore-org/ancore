import { constantTimeEqual } from '../compare';

describe('constantTimeEqual', () => {
  it('returns true for identical arrays', () => {
    const a = new Uint8Array([1, 2, 3]);
    expect(constantTimeEqual(a, new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it('returns true for two empty arrays', () => {
    expect(constantTimeEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true);
  });

  it('returns false for arrays with same length but different bytes', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });

  it('returns false when first byte differs', () => {
    expect(constantTimeEqual(new Uint8Array([0, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('returns false for mismatched lengths (a shorter)', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('returns false for mismatched lengths (b shorter)', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });

  it('returns false when one array is empty', () => {
    expect(constantTimeEqual(new Uint8Array([]), new Uint8Array([0]))).toBe(false);
  });

  it('handles 32-byte arrays (typical key/hash size)', () => {
    const key = new Uint8Array(32).fill(0xab);
    expect(constantTimeEqual(key, new Uint8Array(32).fill(0xab))).toBe(true);
    const different = new Uint8Array(32).fill(0xab);
    different[31] = 0x00;
    expect(constantTimeEqual(key, different)).toBe(false);
  });
});
