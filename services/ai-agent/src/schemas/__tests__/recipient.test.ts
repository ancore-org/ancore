import {
  createRecipientSchema,
  isAcceptableRecipient,
  isStellarAccountAddress,
} from '../recipient';
import {
  CHECKSUM_INVALID_ADDRESS,
  NON_BASE32_ADDRESS,
  UNRESOLVABLE_HANDLE,
  VALID_ADDRESS,
  VALID_HANDLE,
} from '../../__tests__/fixtures/addresses';

/**
 * Issue #1210 — the shared recipient schema, tested directly.
 *
 * The point of these cases is that the composition delegates: everything here
 * is decided by `stellarAddressSchema` / `assertValidEd25519PublicKey`
 * (@ancore/types, @ancore/account-abstraction) and `isUsernameHandle`
 * (@ancore/types), not by anything this service implements.
 */
describe('isStellarAccountAddress', () => {
  it('accepts a checksum-valid address', () => {
    expect(isStellarAccountAddress(VALID_ADDRESS)).toBe(true);
  });

  it('rejects an address with the right shape but a bad checksum', () => {
    // This is the case a format-only regex cannot catch, and the reason the
    // service depends on the StrKey validator rather than a shape check.
    expect(isStellarAccountAddress(CHECKSUM_INVALID_ADDRESS)).toBe(false);
  });

  it('rejects a lookalike containing non-base32 characters', () => {
    expect(isStellarAccountAddress(NON_BASE32_ADDRESS)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['a bare name', 'Bob'],
    ['a truncated address', VALID_ADDRESS.slice(0, 40)],
    ['a contract id prefix', `C${VALID_ADDRESS.slice(1)}`],
    ['a handle', VALID_HANDLE],
  ])('rejects %s', (_label, value) => {
    expect(isStellarAccountAddress(value)).toBe(false);
  });
});

describe('isAcceptableRecipient', () => {
  it.each([
    ['a valid address', VALID_ADDRESS],
    ['a valid handle', VALID_HANDLE],
    // Syntax only — whether it resolves is decided later, in ../recipients.ts.
    ['a well-formed but unknown handle', UNRESOLVABLE_HANDLE],
  ])('accepts %s', (_label, value) => {
    expect(isAcceptableRecipient(value)).toBe(true);
  });

  it.each([
    ['a bare name', 'Bob'],
    ['a checksum-invalid address', CHECKSUM_INVALID_ADDRESS],
    ['an email address', 'alice@example.com'],
    ['a bare @', '@'],
  ])('rejects %s', (_label, value) => {
    expect(isAcceptableRecipient(value)).toBe(false);
  });
});

describe('createRecipientSchema', () => {
  const destination = createRecipientSchema('Destination');
  const recipient = createRecipientSchema('Recipient');

  it('trims surrounding whitespace from an accepted address', () => {
    const result = destination.safeParse(`  ${VALID_ADDRESS}  `);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(VALID_ADDRESS);
    }
  });

  it('labels the required message per field', () => {
    expect(destination.safeParse('').error?.issues[0].message).toBe('Destination is required');
    expect(recipient.safeParse('').error?.issues[0].message).toBe('Recipient is required');
  });

  it('labels the format message per field', () => {
    expect(destination.safeParse('Bob').error?.issues[0].message).toBe(
      'Destination must be a Stellar address (G...) or an @username handle'
    );
    expect(recipient.safeParse('Bob').error?.issues[0].message).toBe(
      'Recipient must be a Stellar address (G...) or an @username handle'
    );
  });

  it('keeps the word "destination" in the payment message', () => {
    // ../../server.ts keys its "Needs clarification" 400 off this substring.
    expect(destination.safeParse('Bob').error?.issues[0].message).toMatch(/destination/i);
  });
});
