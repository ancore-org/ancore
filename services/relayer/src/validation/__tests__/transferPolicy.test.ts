import { validateAssetCode, validateIssuer } from '../transferPolicy';

const VALID_ISSUER = 'GDBXHJ53TGKDOP2O3Q5TKXPMGTHA2OPT5BCBYFCRF4PE3EODQLWYPUIQ';

describe('validateAssetCode', () => {
  it('accepts native XLM codes', () => {
    expect(validateAssetCode('XLM')).toBe(true);
    expect(validateAssetCode('native')).toBe(true);
  });

  it('accepts valid 1-character alphanumeric code', () => {
    expect(validateAssetCode('A')).toBe(true);
  });

  it('accepts valid 4-character alphanumeric code', () => {
    expect(validateAssetCode('USDC')).toBe(true);
  });

  it('accepts valid 12-character alphanumeric code', () => {
    expect(validateAssetCode('ABCDEFGHIJ12')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateAssetCode('')).toBe(false);
  });

  it('rejects code longer than 12 characters', () => {
    expect(validateAssetCode('ABCDEFGHIJ123')).toBe(false);
  });

  it('rejects asset code with spaces', () => {
    expect(validateAssetCode('USD C')).toBe(false);
  });

  it('rejects asset code with special characters', () => {
    expect(validateAssetCode('USD$')).toBe(false);
    expect(validateAssetCode('US-DC')).toBe(false);
  });

  it('rejects asset code with emoji', () => {
    expect(validateAssetCode('🚀')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateAssetCode(null as unknown as string)).toBe(false);
    expect(validateAssetCode(undefined as unknown as string)).toBe(false);
  });
});

describe('validateIssuer', () => {
  it('accepts a valid Stellar G... public key', () => {
    expect(validateIssuer(VALID_ISSUER)).toBe(true);
  });

  it('rejects an address that does not start with G', () => {
    expect(validateIssuer('SAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV3AKSKPD3FN')).toBe(false);
  });

  it('rejects a truncated key', () => {
    expect(validateIssuer('GAHJJJKMOKYE4RVPZEWZ')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateIssuer('')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateIssuer(null as unknown as string)).toBe(false);
    expect(validateIssuer(undefined as unknown as string)).toBe(false);
  });
});
