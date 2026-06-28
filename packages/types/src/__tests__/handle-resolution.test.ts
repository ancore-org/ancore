import {
  handleResolutionResponseSchema,
  isUsernameHandle,
  normalizeUsernameHandle,
  usernameHandleSchema,
} from '../handle-resolution';

describe('handle resolution types', () => {
  it('validates and normalizes @username handles', () => {
    expect(isUsernameHandle('@alice')).toBe(true);
    expect(isUsernameHandle('@')).toBe(false);
    expect(usernameHandleSchema.safeParse('@bad space').success).toBe(false);
    expect(normalizeUsernameHandle('  @Alice  ')).toBe('@alice');
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
