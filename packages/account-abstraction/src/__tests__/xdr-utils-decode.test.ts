import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { scValToU32, decodeVersionResult } from '../xdr-utils';

describe('scValToU32', () => {
  it('decodes 0', () => {
    const scVal = nativeToScVal(0, { type: 'u32' });
    expect(scValToU32(scVal)).toBe(0);
  });

  it('decodes 1', () => {
    const scVal = nativeToScVal(1, { type: 'u32' });
    expect(scValToU32(scVal)).toBe(1);
  });

  it('decodes u32::MAX', () => {
    const scVal = nativeToScVal(4294967295, { type: 'u32' });
    expect(scValToU32(scVal)).toBe(4294967295);
  });

  it('throws a TypeError for a string ScVal', () => {
    const scVal = nativeToScVal('hello');
    expect(() => scValToU32(scVal)).toThrow(TypeError);
    expect(() => scValToU32(scVal)).toThrow(/u32/i);
  });

  it('throws a TypeError for an i128 ScVal', () => {
    const scVal = nativeToScVal(1n, { type: 'i128' });
    expect(() => scValToU32(scVal)).toThrow(TypeError);
    expect(() => scValToU32(scVal)).toThrow(/u32/i);
  });
});

describe('decodeVersionResult', () => {
  it('returns the decoded version for a valid u32 ScVal', () => {
    const scVal = nativeToScVal(1, { type: 'u32' });
    expect(decodeVersionResult(scVal)).toBe(1);
  });

  it('returns the decoded version for a valid u32 ScVal of 0', () => {
    const scVal = nativeToScVal(0, { type: 'u32' });
    expect(decodeVersionResult(scVal)).toBe(0);
  });

  it('throws a clear error for a string ScVal', () => {
    const scVal = nativeToScVal('hello');
    expect(() => decodeVersionResult(scVal)).toThrow(TypeError);
    expect(() => decodeVersionResult(scVal)).toThrow(/u32/i);
  });

  it('throws a clear error for an i128 ScVal', () => {
    const scVal = nativeToScVal(1n, { type: 'i128' });
    expect(() => decodeVersionResult(scVal)).toThrow(TypeError);
    expect(() => decodeVersionResult(scVal)).toThrow(/u32/i);
  });

  it('throws a clear error for an undefined result', () => {
    expect(() => decodeVersionResult(undefined as unknown as xdr.ScVal)).toThrow();
  });
});