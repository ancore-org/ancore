import { toBase58, fromBase58 } from '../encoding';

describe('base58 encode/decode', () => {
  it('round-trips arbitrary bytes', () => {
    const input = new Uint8Array([0, 1, 2, 255, 128, 64]);
    expect(fromBase58(toBase58(input))).toEqual(input);
  });

  it('round-trips leading zero bytes', () => {
    const input = new Uint8Array([0, 0, 1, 2, 3]);
    expect(fromBase58(toBase58(input))).toEqual(input);
  });

  it('round-trips all-zero bytes', () => {
    const input = new Uint8Array([0, 0, 0]);
    expect(fromBase58(toBase58(input))).toEqual(input);
  });

  it('round-trips empty bytes', () => {
    // empty input encodes to "" which is not a valid base58 string
    const input = new Uint8Array(0);
    expect(toBase58(input)).toBe('');
  });

  it('toBase58 throws on non-Uint8Array', () => {
    // @ts-expect-error intentional invalid input
    expect(() => toBase58('not bytes')).toThrow(TypeError);
  });

  it('fromBase58 throws on invalid characters', () => {
    expect(() => fromBase58('0OIl')).toThrow(TypeError);
  });

  it('fromBase58 throws on empty string', () => {
    expect(() => fromBase58('')).toThrow(TypeError);
  });

  it('fromBase58 throws on non-string', () => {
    // @ts-expect-error intentional invalid input
    expect(() => fromBase58(123)).toThrow(TypeError);
  });
});
