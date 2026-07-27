import { describe, expect, it } from 'vitest';
import { isValidStellarAddress, stellarAddressError } from '../address-validation';

const G_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const C_ADDRESS = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

describe('isValidStellarAddress', () => {
  it('accepts a classic G account address', () => {
    expect(isValidStellarAddress(G_ADDRESS)).toBe(true);
  });

  it('accepts a C contract address', () => {
    expect(isValidStellarAddress(C_ADDRESS)).toBe(true);
  });

  it('ignores surrounding whitespace so pasted addresses validate', () => {
    expect(isValidStellarAddress(`  ${G_ADDRESS}\n`)).toBe(true);
  });

  it('rejects blank input', () => {
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress('   ')).toBe(false);
  });

  it('rejects an address that is too short', () => {
    expect(isValidStellarAddress(G_ADDRESS.slice(0, -1))).toBe(false);
  });

  it('rejects an address that is too long', () => {
    expect(isValidStellarAddress(`${G_ADDRESS}A`)).toBe(false);
  });

  it('rejects an unsupported StrKey prefix', () => {
    // S… is a secret seed — never a valid recipient.
    expect(isValidStellarAddress(`S${G_ADDRESS.slice(1)}`)).toBe(false);
  });

  it('rejects lowercase input', () => {
    expect(isValidStellarAddress(G_ADDRESS.toLowerCase())).toBe(false);
  });

  it('rejects characters outside the base32 alphabet', () => {
    for (const char of ['0', '1', '8', '9']) {
      expect(isValidStellarAddress(`${G_ADDRESS.slice(0, -1)}${char}`)).toBe(false);
    }
  });

  it('honours a restricted kind list', () => {
    expect(isValidStellarAddress(C_ADDRESS, ['account'])).toBe(false);
    expect(isValidStellarAddress(G_ADDRESS, ['account'])).toBe(true);
    expect(isValidStellarAddress(G_ADDRESS, ['contract'])).toBe(false);
    expect(isValidStellarAddress(C_ADDRESS, ['contract'])).toBe(true);
  });
});

describe('stellarAddressError', () => {
  it('returns null for a valid address', () => {
    expect(stellarAddressError(G_ADDRESS)).toBeNull();
    expect(stellarAddressError(C_ADDRESS)).toBeNull();
  });

  it('treats a blank value as valid when no requiredMessage is given', () => {
    expect(stellarAddressError('')).toBeNull();
  });

  it('returns the requiredMessage for a blank value when the field is required', () => {
    expect(stellarAddressError('  ', { requiredMessage: 'Recipient address is required' })).toBe(
      'Recipient address is required'
    );
  });

  it('names both accepted formats by default', () => {
    expect(stellarAddressError('not-an-address')).toBe('Enter a valid Stellar address (G… or C…)');
  });

  it('names only the accepted format when kinds are restricted', () => {
    expect(stellarAddressError(C_ADDRESS, { kinds: ['account'] })).toBe(
      'Enter a valid Stellar address (G…)'
    );
  });

  it('always mentions "address" so send errors route to the recipient field', () => {
    expect(stellarAddressError('nope')).toContain('address');
  });
});
