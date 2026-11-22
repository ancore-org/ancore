import {
  stellarAddressSchema,
  contactAliasSchema,
  ContactSchema,
  ContactPayloadSchema,
} from '../contacts';

describe('stellarAddressSchema', () => {
  it('accepts a valid Stellar address (G + 55 uppercase alphanumeric)', () => {
    const address = 'G' + 'A'.repeat(55);
    expect(stellarAddressSchema.parse(address)).toBe(address);
  });

  it('accepts a valid Stellar address with mixed uppercase letters and digits', () => {
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345';
    expect(address).toHaveLength(56);
    expect(stellarAddressSchema.parse(address)).toBe(address);
  });

  it('rejects a lowercase address', () => {
    const address = 'g' + 'a'.repeat(55);
    expect(stellarAddressSchema.safeParse(address).success).toBe(false);
  });

  it('rejects an address that is too short', () => {
    const address = 'G' + 'A'.repeat(54);
    expect(stellarAddressSchema.safeParse(address).success).toBe(false);
  });

  it('rejects an address that is too long', () => {
    const address = 'G' + 'A'.repeat(56);
    expect(stellarAddressSchema.safeParse(address).success).toBe(false);
  });

  it('rejects an address that does not start with G', () => {
    const address = 'A' + 'A'.repeat(55);
    expect(stellarAddressSchema.safeParse(address).success).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(stellarAddressSchema.safeParse(123).success).toBe(false);
    expect(stellarAddressSchema.safeParse(null).success).toBe(false);
    expect(stellarAddressSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('contactAliasSchema', () => {
  it('accepts a 1-character alias', () => {
    expect(contactAliasSchema.parse('a')).toBe('a');
  });

  it('accepts a 32-character alias', () => {
    const alias = 'a'.repeat(32);
    expect(contactAliasSchema.parse(alias)).toBe(alias);
  });

  it('rejects an empty alias', () => {
    expect(contactAliasSchema.safeParse('').success).toBe(false);
  });

  it('rejects a 33-character alias', () => {
    const alias = 'a'.repeat(33);
    expect(contactAliasSchema.safeParse(alias).success).toBe(false);
  });

  it('rejects aliases with disallowed characters such as "@"', () => {
    expect(contactAliasSchema.safeParse('user@name').success).toBe(false);
  });

  it('rejects aliases with disallowed characters such as "."', () => {
    expect(contactAliasSchema.safeParse('user.name').success).toBe(false);
  });

  it('does not trim whitespace, so a whitespace-only alias is accepted by the regex', () => {
    // The schema does NOT trim input; whitespace is an allowed character.
    expect(contactAliasSchema.parse('   ')).toBe('   ');
  });

  it('does not trim surrounding whitespace from an alias', () => {
    expect(contactAliasSchema.parse('  alice  ')).toBe('  alice  ');
  });
});

describe('ContactSchema', () => {
  const validAddress = 'G' + 'A'.repeat(55);

  const validContact = {
    id: 'contact-1',
    alias: 'alice',
    address: validAddress,
    createdAt: 1700000000000,
  };

  it('parses a valid contact', () => {
    const result = ContactSchema.parse(validContact);
    expect(result.id).toBe('contact-1');
    expect(result.alias).toBe('alice');
    expect(result.address).toBe(validAddress);
    expect(result.createdAt).toBe(1700000000000);
  });

  it('defaults isFavorite to false when omitted', () => {
    const result = ContactSchema.parse(validContact);
    expect(result.isFavorite).toBe(false);
  });

  it('accepts an explicit isFavorite value', () => {
    const result = ContactSchema.parse({ ...validContact, isFavorite: true });
    expect(result.isFavorite).toBe(true);
  });

  it('allows updatedAt to be omitted', () => {
    const result = ContactSchema.parse(validContact);
    expect(result.updatedAt).toBeUndefined();
  });

  it('accepts an updatedAt value when provided', () => {
    const result = ContactSchema.parse({ ...validContact, updatedAt: 1700000001000 });
    expect(result.updatedAt).toBe(1700000001000);
  });

  it('allows notes to be omitted', () => {
    const result = ContactSchema.parse(validContact);
    expect(result.notes).toBeUndefined();
  });

  it('accepts notes when provided', () => {
    const result = ContactSchema.parse({ ...validContact, notes: 'some note' });
    expect(result.notes).toBe('some note');
  });

  it('rejects an invalid Stellar address', () => {
    expect(
      ContactSchema.safeParse({ ...validContact, address: 'invalid' }).success,
    ).toBe(false);
  });

  it('rejects an empty id', () => {
    expect(ContactSchema.safeParse({ ...validContact, id: '' }).success).toBe(false);
  });

  it('rejects a non-integer createdAt', () => {
    expect(
      ContactSchema.safeParse({ ...validContact, createdAt: 1.5 }).success,
    ).toBe(false);
  });

  it('rejects a negative createdAt', () => {
    expect(
      ContactSchema.safeParse({ ...validContact, createdAt: -1 }).success,
    ).toBe(false);
  });

  it('strips unknown extra keys by default', () => {
    const result = ContactSchema.parse({ ...validContact, extra: 'value' });
    expect((result as Record<string, unknown>).extra).toBeUndefined();
  });
});

describe('ContactPayloadSchema', () => {
  const validAddress = 'G' + 'A'.repeat(55);

  const validPayload = {
    alias: 'alice',
    address: validAddress,
  };

  it('parses a valid payload', () => {
    const result = ContactPayloadSchema.parse(validPayload);
    expect(result.alias).toBe('alice');
    expect(result.address).toBe(validAddress);
  });

  it('allows isFavorite to be omitted', () => {
    const result = ContactPayloadSchema.parse(validPayload);
    expect(result.isFavorite).toBeUndefined();
  });

  it('accepts an explicit isFavorite value', () => {
    const result = ContactPayloadSchema.parse({ ...validPayload, isFavorite: true });
    expect(result.isFavorite).toBe(true);
  });

  it('rejects an invalid Stellar address', () => {
    expect(
      ContactPayloadSchema.safeParse({ ...validPayload, address: 'invalid' }).success,
    ).toBe(false);
  });

  it('rejects an empty alias', () => {
    expect(
      ContactPayloadSchema.safeParse({ ...validPayload, alias: '' }).success,
    ).toBe(false);
  });
});