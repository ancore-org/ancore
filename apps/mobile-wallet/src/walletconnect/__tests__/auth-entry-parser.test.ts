import { parseAuthEntryXdr } from '../auth-entry-parser';

describe('parseAuthEntryXdr', () => {
  it('parses a base64 auth entry payload', () => {
    const entryXdr = Buffer.from('transfer_invoke_CABCDEF').toString('base64');
    const parsed = parseAuthEntryXdr(entryXdr);

    expect(parsed.entryXdr).toBe(entryXdr);
    expect(parsed.functionName).toBeTruthy();
    expect(parsed.contractId).toBeTruthy();
  });

  it('rejects missing XDR', () => {
    expect(() => parseAuthEntryXdr('')).toThrow('Missing auth entry XDR');
  });

  it('rejects empty decoded payload', () => {
    expect(() => parseAuthEntryXdr('=')).toThrow('Auth entry XDR is empty');
  });
});
