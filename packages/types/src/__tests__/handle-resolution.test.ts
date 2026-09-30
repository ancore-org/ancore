import {
  handleResolutionResponseSchema,
  isUsernameHandle,
  normalizeUsernameHandle,
  usernameHandleSchema,
  type UsernameHandle,
} from '../handle-resolution';

describe('handle resolution types', () => {
  it('validates and normalizes @username handles', () => {
    expect(isUsernameHandle('@alice')).toBe(true);
    expect(isUsernameHandle('@')).toBe(false);
    expect(usernameHandleSchema.safeParse('@bad space').success).toBe(false);
  });

  it('accepts found and not-found resolver contracts', () => {
    expect(
      handleResolutionResponseSchema.safeParse({
        status: 'found',
        result: {
          handle: '@alice',
          accountAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          displayName: 'Alice',
        },
      }).success
    ).toBe(true);

    expect(handleResolutionResponseSchema.parse({ status: 'not_found' })).toEqual({
      status: 'not_found',
      error: 'Handle not found',
    });
  });
});

describe('normalizeUsernameHandle', () => {
  it('preserves the valid trim + lowercase behavior', () => {
    expect(normalizeUsernameHandle('  @Alice  ')).toBe('@alice');
    expect(normalizeUsernameHandle('@alice')).toBe('@alice');
  });

  it('returns null instead of branding invalid raw strings', () => {
    expect(normalizeUsernameHandle('  !!!not-valid  ')).toBeNull();
    expect(normalizeUsernameHandle('no-at-sign')).toBeNull();
    expect(normalizeUsernameHandle('@bad space')).toBeNull();
    expect(normalizeUsernameHandle('@')).toBeNull();
    expect(normalizeUsernameHandle(`@${'a'.repeat(32)}`)).toBeNull();
  });

  it('round-trips branded input as a non-null UsernameHandle', () => {
    // The branded overload returns `UsernameHandle`, so this compiles without a
    // null check — the type-level proof that already-branded handles survive.
    const handle = normalizeUsernameHandle('@Alice' as UsernameHandle);
    expect(handle).toBe('@alice');
    expect(handle.startsWith('@')).toBe(true);
  });
});
