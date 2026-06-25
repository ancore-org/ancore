import { publicKeyToBytes32ScVal } from '../xdr-utils';
import { StrKeyValidationError } from '@ancore/core-sdk';

describe('xdr-utils publicKey validation', () => {
  test('publicKeyToBytes32ScVal throws StrKeyValidationError for invalid public key string', () => {
    expect(() => publicKeyToBytes32ScVal('NOT_A_KEY')).toThrow(StrKeyValidationError);
    try {
      publicKeyToBytes32ScVal('NOT_A_KEY');
    } catch (err) {
      expect(err).toHaveProperty('code', 'INVALID_G_KEY');
    }
  });
});
