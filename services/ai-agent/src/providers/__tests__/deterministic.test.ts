import { deterministicDraftIntent } from '../deterministic';

describe('deterministicDraftIntent', () => {
  it('drafts a payment intent by default', () => {
    const result = deterministicDraftIntent({ prompt: 'Send 10 XLM to Alice', accountId: 'GACC' });
    expect(result.intent.type).toBe('payment');
    if (result.intent.type === 'payment') {
      expect(result.intent.amount).toBe('10');
      expect(result.intent.asset).toBe('XLM');
    }
    expect(result.summary).toBe('Drafted payment intent');
  });

  it('drafts an invoice intent when the prompt mentions "invoice"', () => {
    const result = deterministicDraftIntent({
      prompt: 'Create an invoice for 50 USDC',
      accountId: 'GACC',
    });
    expect(result.intent.type).toBe('invoice');
    if (result.intent.type === 'invoice') {
      expect(result.intent.amount).toBe('50');
      expect(result.intent.asset).toBe('USDC');
      expect(result.intent.recipient).toBe('GACC');
      expect(Date.parse(result.intent.dueDate)).not.toBeNaN();
    }
  });

  it('extracts a Stellar destination address when present in the prompt', () => {
    // 56 chars total ("G" + 55 base32 chars) — the real Stellar strkey length.
    const dest = 'GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5';
    const result = deterministicDraftIntent({
      prompt: `Send 25 XLM to ${dest}`,
      accountId: 'GACC',
    });
    expect(result.intent.type).toBe('payment');
    if (result.intent.type === 'payment') {
      expect(result.intent.destination).toBe(dest);
    }
  });

  it('rejects prompts without a parseable destination instead of fabricating one', () => {
    expect(() =>
      deterministicDraftIntent({ prompt: 'Send 10 XLM to Bob', accountId: 'GACC' })
    ).toThrow(/destination/i);
  });

  it('defaults amount to "10" when no number is present in the prompt', () => {
    const result = deterministicDraftIntent({ prompt: 'Send some XLM to Bob', accountId: 'GACC' });
    if (result.intent.type === 'payment') {
      expect(result.intent.amount).toBe('10');
    }
  });

  it('always produces schema-valid output', () => {
    const result = deterministicDraftIntent({
      prompt: 'invoice bill me for 1.5 usdc',
      accountId: 'GACC',
    });
    // amount must satisfy the ^\d+(\.\d+)?$ format required by the Zod schemas
    expect(result.intent.amount).toMatch(/^\d+(\.\d+)?$/);
  });
});
