import { normalizeError } from '../errors';

describe('normalizeError', () => {
  it('extracts explicit uppercase codes from Error message', () => {
    const err = new Error('ECONNREFUSED: Connection refused');
    const n = normalizeError(err);
    expect(n.code).toBe('ECONNREFUSED');
    expect(n.category).toBe('NETWORK');
  });

  it('classifies validation message', () => {
    const err = new Error('validation failed: missing field');
    const n = normalizeError(err);
    expect(n.code).toBe('VALIDATION_ERROR');
    expect(n.category).toBe('VALIDATION');
  });

  it('accepts plain canonical objects with code/message', () => {
    const obj = { code: 'ALREADY_INITIALIZED', message: 'Already initialized' };
    const n = normalizeError(obj);
    expect(n.code).toBe('ALREADY_INITIALIZED');
    expect(n.category).toBe('CONTRACT');
  });
});
