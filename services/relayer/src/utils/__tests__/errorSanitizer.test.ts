import { INTERNAL_STORAGE_ERROR, sanitizeErrorMessage } from '../errorSanitizer';

describe('sanitizeErrorMessage', () => {
  it('replaces a missing-relation error with a generic storage message', () => {
    const raw = 'relation "used_nonces" does not exist';
    expect(sanitizeErrorMessage(raw)).toBe(INTERNAL_STORAGE_ERROR);
    expect(sanitizeErrorMessage(raw)).not.toContain('used_nonces');
  });

  it('replaces a syntax error and does not leave the SQL fragment', () => {
    const raw = 'syntax error at or near "SELEC"';
    expect(sanitizeErrorMessage(raw)).toBe(INTERNAL_STORAGE_ERROR);
    expect(sanitizeErrorMessage(raw)).not.toMatch(/syntax error at/i);
  });

  it('strips column names from column-does-not-exist errors', () => {
    const raw = 'column "nonce" of relation "used_nonces" does not exist';
    const sanitized = sanitizeErrorMessage(raw);
    expect(sanitized).toBe(INTERNAL_STORAGE_ERROR);
    expect(sanitized).not.toContain('nonce');
    expect(sanitized).not.toContain('used_nonces');
  });

  it('leaves ordinary validation messages unchanged', () => {
    expect(sanitizeErrorMessage('Nonce already used')).toBe('Nonce already used');
  });
});
