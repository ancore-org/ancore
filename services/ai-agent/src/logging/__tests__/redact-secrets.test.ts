import { redactSecrets } from '../redact-secrets';

describe('redactSecrets', () => {
  it('redacts a Stellar secret key (S + 55 base32 chars)', () => {
    const secret = 'S' + 'A'.repeat(55);
    expect(secret).toHaveLength(56);
    const text = `Please use my secret ${secret} to sign this.`;
    const result = redactSecrets(text);
    expect(result).not.toContain(secret);
    expect(result).toContain('[REDACTED]');
  });

  it('does not redact a Stellar public key (G-prefixed)', () => {
    const pub = 'G' + 'A'.repeat(55);
    const text = `Send to ${pub}`;
    const result = redactSecrets(text);
    expect(result).toContain(pub);
  });

  it('redacts a BIP-39-shaped 12-word seed phrase', () => {
    const seed =
      'abandon ability able about above absent absorb abstract absurd abuse access accident';
    const text = `Here is my wallet recovery phrase: ${seed}. Please import it.`;
    const result = redactSecrets(text);
    expect(result).not.toContain(seed);
    expect(result).toContain('[REDACTED]');
  });

  it('redacts an Anthropic-shaped API key', () => {
    const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789';
    const text = `My key is ${key}, keep it safe.`;
    const result = redactSecrets(text);
    expect(result).not.toContain(key);
    expect(result).toContain('[REDACTED]');
  });

  it('redacts a GitHub-shaped token', () => {
    const token = 'ghp_' + 'x'.repeat(36);
    const text = `token: ${token}`;
    const result = redactSecrets(text);
    expect(result).not.toContain(token);
  });

  it('redacts an AWS access key id', () => {
    const key = 'AKIAABCDEFGHIJKLMNOP';
    const text = `aws key ${key}`;
    const result = redactSecrets(text);
    expect(result).not.toContain(key);
  });

  it('redacts a raw Bearer token', () => {
    const text = 'Authorization: Bearer abc123.def456-ghi789_jklmno';
    const result = redactSecrets(text);
    expect(result).not.toContain('abc123.def456-ghi789_jklmno');
  });

  it('leaves ordinary prompt text untouched', () => {
    const text = 'Send 10 XLM to Alice for lunch';
    expect(redactSecrets(text)).toBe(text);
  });

  it('handles empty and non-string input safely', () => {
    expect(redactSecrets('')).toBe('');
    expect(redactSecrets(undefined as unknown as string)).toBeUndefined();
    expect(redactSecrets(null as unknown as string)).toBeNull();
  });
});
