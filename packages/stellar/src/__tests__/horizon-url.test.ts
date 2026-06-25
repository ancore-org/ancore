import { validateHorizonUrl, isValidHorizonUrl, HorizonUrlValidationError } from '../horizon-url';

describe('validateHorizonUrl', () => {
  describe('mainnet validation', () => {
    it('accepts official mainnet Horizon URL', () => {
      expect(() => validateHorizonUrl('https://horizon.stellar.org', 'mainnet')).not.toThrow();
    });

    it('accepts mainnet subdomain URLs', () => {
      expect(() =>
        validateHorizonUrl('https://horizon-public.stellar.org', 'mainnet')
      ).not.toThrow();
    });

    it('rejects HTTP for mainnet', () => {
      expect(() => validateHorizonUrl('http://horizon.stellar.org', 'mainnet')).toThrow(
        HorizonUrlValidationError
      );
      try {
        validateHorizonUrl('http://horizon.stellar.org', 'mainnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('INVALID_SCHEME');
        }
      }
    });

    it('rejects localhost for mainnet', () => {
      expect(() => validateHorizonUrl('http://localhost:8000', 'mainnet')).toThrow(
        HorizonUrlValidationError
      );
      try {
        validateHorizonUrl('http://localhost:8000', 'mainnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('LOCALHOST_NOT_ALLOWED');
        }
      }
    });

    it('rejects testnet URL on mainnet profile', () => {
      expect(() => validateHorizonUrl('https://horizon-testnet.stellar.org', 'mainnet')).toThrow(
        HorizonUrlValidationError
      );
      try {
        validateHorizonUrl('https://horizon-testnet.stellar.org', 'mainnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('NETWORK_MISMATCH');
        }
      }
    });

    it('rejects invalid hostname', () => {
      expect(() => validateHorizonUrl('https://evil.com', 'mainnet')).toThrow(
        HorizonUrlValidationError
      );
      try {
        validateHorizonUrl('https://evil.com', 'mainnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('INVALID_HOSTNAME');
        }
      }
    });
  });

  describe('testnet validation', () => {
    it('accepts official testnet Horizon URL', () => {
      expect(() =>
        validateHorizonUrl('https://horizon-testnet.stellar.org', 'testnet')
      ).not.toThrow();
    });

    it('rejects mainnet URL on testnet profile', () => {
      expect(() => validateHorizonUrl('https://horizon.stellar.org', 'testnet')).toThrow(
        HorizonUrlValidationError
      );
      try {
        validateHorizonUrl('https://horizon.stellar.org', 'testnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('NETWORK_MISMATCH');
        }
      }
    });

    it('rejects HTTP for testnet', () => {
      expect(() => validateHorizonUrl('http://horizon-testnet.stellar.org', 'testnet')).toThrow(
        HorizonUrlValidationError
      );
      try {
        validateHorizonUrl('http://horizon-testnet.stellar.org', 'testnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('INVALID_SCHEME');
        }
      }
    });
  });

  describe('futurenet validation', () => {
    it('accepts official futurenet Horizon URL', () => {
      expect(() =>
        validateHorizonUrl('https://horizon-futurenet.stellar.org', 'futurenet')
      ).not.toThrow();
    });

    it('rejects mainnet URL on futurenet profile', () => {
      expect(() => validateHorizonUrl('https://horizon.stellar.org', 'futurenet')).toThrow(
        HorizonUrlValidationError
      );
    });
  });

  describe('local validation', () => {
    it('accepts localhost with HTTP', () => {
      expect(() => validateHorizonUrl('http://localhost:8000', 'local')).not.toThrow();
    });

    it('accepts 127.0.0.1 with HTTP', () => {
      expect(() => validateHorizonUrl('http://127.0.0.1:8000', 'local')).not.toThrow();
    });

    it('accepts localhost without port', () => {
      expect(() => validateHorizonUrl('http://localhost', 'local')).not.toThrow();
    });

    it('rejects non-localhost hostnames', () => {
      expect(() => validateHorizonUrl('http://example.com', 'local')).toThrow(
        HorizonUrlValidationError
      );
      try {
        validateHorizonUrl('http://example.com', 'local');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('INVALID_HOSTNAME');
        }
      }
    });
  });

  describe('invalid input handling', () => {
    it('throws for empty string', () => {
      expect(() => validateHorizonUrl('', 'mainnet')).toThrow(HorizonUrlValidationError);
      try {
        validateHorizonUrl('', 'mainnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('INVALID_URL');
        }
      }
    });

    it('throws for null input', () => {
      expect(() => validateHorizonUrl(null as unknown as string, 'mainnet')).toThrow(
        HorizonUrlValidationError
      );
    });

    it('throws for malformed URL', () => {
      expect(() => validateHorizonUrl('not-a-url', 'mainnet')).toThrow(HorizonUrlValidationError);
      try {
        validateHorizonUrl('not-a-url', 'mainnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.code).toBe('INVALID_URL');
        }
      }
    });

    it('trims whitespace before validation', () => {
      expect(() => validateHorizonUrl('  https://horizon.stellar.org  ', 'mainnet')).not.toThrow();
    });
  });

  describe('error details', () => {
    it('includes URL and network in error', () => {
      try {
        validateHorizonUrl('http://evil.com', 'mainnet');
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HorizonUrlValidationError);
        if (err instanceof HorizonUrlValidationError) {
          expect(err.url).toBe('http://evil.com');
          expect(err.network).toBe('mainnet');
          expect(err.code).toBeDefined();
          expect(err.message).toBeDefined();
        }
      }
    });
  });
});

describe('isValidHorizonUrl', () => {
  it('returns true for valid URLs', () => {
    expect(isValidHorizonUrl('https://horizon.stellar.org', 'mainnet')).toBe(true);
    expect(isValidHorizonUrl('https://horizon-testnet.stellar.org', 'testnet')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidHorizonUrl('http://horizon.stellar.org', 'mainnet')).toBe(false);
    expect(isValidHorizonUrl('https://evil.com', 'mainnet')).toBe(false);
    expect(isValidHorizonUrl('', 'mainnet')).toBe(false);
  });

  it('does not throw for invalid URLs', () => {
    expect(() => isValidHorizonUrl('invalid-url', 'mainnet')).not.toThrow();
  });
});
