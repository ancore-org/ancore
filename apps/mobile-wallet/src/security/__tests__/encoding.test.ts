import { bufferToBase64, base64ToBytes, EncodingError } from '../encoding';

describe('Security Encoding Infrastructure Guards', () => {
  it('should cleanly perform round-trip transformations without data loss', () => {
    const mockBytes = new Uint8Array([83, 117, 112, 101, 114, 83, 101, 99, 114, 101, 116]);
    const encodedBase64 = bufferToBase64(mockBytes);
    const decodedBytes = base64ToBytes(encodedBase64);

    expect(decodedBytes).toEqual(mockBytes);
  });

  it('should reject structurally broken characters by throwing a descriptive EncodingError', () => {
    const invalidPayload = 'not*base64';

    expect(() => {
      base64ToBytes(invalidPayload);
    }).toThrow(EncodingError);

    expect(() => {
      base64ToBytes(invalidPayload);
    }).toThrow('invalid base64');
  });

  it('should fail on inputs that break the 4-byte padding modulus alignment constraint', () => {
    const unpaddedMismatchedLength = 'dGVzdA';

    expect(() => {
      base64ToBytes(unpaddedMismatchedLength);
    }).toThrow(EncodingError);
  });
});
