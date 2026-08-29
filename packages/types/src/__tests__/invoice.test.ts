import { createInvoiceSchema } from '../invoice';

const VALID_ADDRESS = `G${'A'.repeat(55)}`;
const OTHER_VALID_ADDRESS = `G${'B'.repeat(55)}`;

describe('createInvoiceSchema', () => {
  const validInput = {
    accountAddress: VALID_ADDRESS,
    recipientAddress: OTHER_VALID_ADDRESS,
    amount: '100',
    asset: 'XLM',
  };

  it('accepts a minimal valid input with no dueDate', () => {
    const parsed = createInvoiceSchema.parse(validInput);
    expect(parsed.accountAddress).toBe(VALID_ADDRESS);
    expect(parsed.dueDate).toBeUndefined();
  });

  it('accepts a dueDate in the future', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const parsed = createInvoiceSchema.parse({ ...validInput, dueDate: futureDate });
    expect(parsed.dueDate).toBe(futureDate);
  });

  it('rejects a dueDate in the past', () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(() => createInvoiceSchema.parse({ ...validInput, dueDate: pastDate })).toThrow(
      /dueDate must not be in the past/
    );
  });

  it('rejects a dueDate that is not a valid ISO 8601 datetime', () => {
    expect(() => createInvoiceSchema.parse({ ...validInput, dueDate: '2024-01-01' })).toThrow();
  });

  it('rejects an accountAddress that is not a Stellar public key', () => {
    expect(() =>
      createInvoiceSchema.parse({ ...validInput, accountAddress: 'not-an-address' })
    ).toThrow(/valid Stellar public key/);
  });
});
