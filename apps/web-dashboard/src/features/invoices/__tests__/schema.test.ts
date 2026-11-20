import { describe, expect, it } from 'vitest';
import { createInvoiceSchema } from '../schema';

const VALID_ADDRESS = `G${'A'.repeat(55)}`;
const OTHER_VALID_ADDRESS = `G${'B'.repeat(55)}`;

describe('createInvoiceSchema', () => {
  const validInput = {
    accountAddress: VALID_ADDRESS,
    recipientAddress: OTHER_VALID_ADDRESS,
    amount: '100',
    asset: 'XLM',
  };

  it('accepts future due date', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    expect(createInvoiceSchema.parse({ ...validInput, dueDate: futureDate }).dueDate).toBe(futureDate);
  });

  it('rejects past due date', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(() => createInvoiceSchema.parse({ ...validInput, dueDate: pastDate })).toThrow();
  });
});
