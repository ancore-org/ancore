import { deterministicDraftIntent } from '../deterministic';
import { VALID_ACCOUNT_ID, VALID_ADDRESS } from '../../__tests__/fixtures/addresses';

describe('deterministicDraftIntent', () => {
  it('drafts a payment intent by default', () => {
    const result = deterministicDraftIntent({
      prompt: `Send 10 XLM to ${VALID_ADDRESS}`,
      accountId: VALID_ACCOUNT_ID,
    });
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
      accountId: VALID_ACCOUNT_ID,
    });
    expect(result.intent.type).toBe('invoice');
    if (result.intent.type === 'invoice') {
      expect(result.intent.amount).toBe('50');
      expect(result.intent.asset).toBe('USDC');
      expect(result.intent.recipient).toBe(VALID_ACCOUNT_ID);
      expect(Date.parse(result.intent.dueDate)).not.toBeNaN();
    }
  });

  it('extracts a Stellar destination address when present in the prompt', () => {
    // 56 chars total ("G" + 55 base32 chars) — the real Stellar strkey length.
    const dest = VALID_ADDRESS;
    const result = deterministicDraftIntent({
      prompt: `Send 25 XLM to ${dest}`,
      accountId: VALID_ACCOUNT_ID,
    });
    expect(result.intent.type).toBe('payment');
    if (result.intent.type === 'payment') {
      expect(result.intent.destination).toBe(dest);
    }
  });

  it('rejects prompts without a parseable destination instead of fabricating one', () => {
    expect(() =>
      deterministicDraftIntent({ prompt: 'Send 10 XLM to Bob', accountId: VALID_ACCOUNT_ID })
    ).toThrow(/destination/i);
  });

  it('defaults amount to "10" when no number is present in the prompt', () => {
    const result = deterministicDraftIntent({
      prompt: `Send some XLM to ${VALID_ADDRESS}`,
      accountId: VALID_ACCOUNT_ID,
    });
    if (result.intent.type === 'payment') {
      expect(result.intent.amount).toBe('10');
    }
  });

  it('does not mistake base32 digits inside the destination for the amount', () => {
    // Stellar strkeys use the digits 2-7, so an unguarded amount scan picks one up.
    const dest = VALID_ADDRESS;
    const result = deterministicDraftIntent({
      prompt: `Pay ${dest} 25 XLM`,
      accountId: VALID_ACCOUNT_ID,
    });
    if (result.intent.type === 'payment') {
      expect(result.intent.amount).toBe('25');
    }
  });

  it('picks the amount near the asset keyword, not the first number in the prompt', () => {
    // "3 days" precedes the actual payment amount here; a naive first-number
    // scan would extract "3" instead of "25".
    const dest = VALID_ADDRESS;
    const result = deterministicDraftIntent({
      prompt: `wait 3 days then send 25 XLM to ${dest}`,
      accountId: VALID_ACCOUNT_ID,
    });
    if (result.intent.type === 'payment') {
      expect(result.intent.amount).toBe('25');
    }
  });

  it('picks the amount near the asset keyword when the keyword precedes the number', () => {
    const dest = VALID_ADDRESS;
    const result = deterministicDraftIntent({
      prompt: `after 2 attempts send USDC 25 to ${dest}`,
      accountId: VALID_ACCOUNT_ID,
    });
    if (result.intent.type === 'payment') {
      expect(result.intent.amount).toBe('25');
    }
  });

  it('always produces schema-valid output', () => {
    const result = deterministicDraftIntent({
      prompt: 'invoice bill me for 1.5 usdc',
      accountId: VALID_ACCOUNT_ID,
    });
    // amount must satisfy the ^\d+(\.\d+)?$ format required by the Zod schemas
    expect(result.intent.amount).toMatch(/^\d+(\.\d+)?$/);
  });
});
