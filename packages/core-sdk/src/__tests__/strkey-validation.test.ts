import { assertValidEd25519PublicKey, assertValidContractId, StrKeyValidationError } from '../errors';

describe('StrKey validation helpers', () => {
  test('assertValidEd25519PublicKey throws StrKeyValidationError for invalid G key', () => {
    expect(() => assertValidEd25519PublicKey('GINVALID')).toThrow(StrKeyValidationError);
    try {
      assertValidEd25519PublicKey('GINVALID');
    } catch (err) {
      expect(err).toHaveProperty('code', 'INVALID_G_KEY');
      expect(err).toMatchSnapshot();
    }
  });

  test('assertValidContractId throws StrKeyValidationError for invalid C key', () => {
    expect(() => assertValidContractId('CINVALID')).toThrow(StrKeyValidationError);
    try {
      assertValidContractId('CINVALID');
    } catch (err) {
      expect(err).toHaveProperty('code', 'INVALID_C_KEY');
      expect(err).toMatchSnapshot();
    }
  });
});
