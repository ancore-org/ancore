import { randomBytes } from '../random';

describe('randomBytes', () => {
  it('should generate a Uint8Array of the correct length', () => {
    const length = 16;
    const bytes = randomBytes(length);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(length);
  });

  it('should generate different bytes on each call', () => {
    const bytes1 = randomBytes(16);
    const bytes2 = randomBytes(16);
    expect(bytes1).not.toEqual(bytes2);
  });

  it('should throw an error for invalid byte lengths', () => {
    expect(() => randomBytes(-1)).toThrow(TypeError);
    expect(() => randomBytes(65537)).toThrow(TypeError);
    expect(() => randomBytes(NaN)).toThrow(TypeError);
    expect(() => randomBytes(1.5)).toThrow(TypeError);
    expect(() => randomBytes(Infinity)).toThrow(TypeError);
  });

  it('should accept 0 bytes and return an empty Uint8Array', () => {
    const bytes = randomBytes(0);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(0);
  });
});
