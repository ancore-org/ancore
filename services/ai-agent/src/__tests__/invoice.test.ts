import request from 'supertest';
import { createApp } from '../server';
import { parseInvoiceIntent, InvoiceIntentSchema } from '../intents/invoice';
import { VALID_ADDRESS, VALID_HANDLE } from './fixtures/addresses';

const TEST_API_KEY = 'test-api-key';
process.env['AI_AGENT_API_KEY'] = TEST_API_KEY;

describe('Invoice Intent Schema and Validation', () => {
  describe('Schema Validation', () => {
    it('validates a complete and correct invoice intent', () => {
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'USDC',
        recipient: VALID_ADDRESS,
        dueDate: '2026-12-31T23:59:59Z',
      };
      const result = parseInvoiceIntent(fixture);
      expect(result).toEqual(fixture);
    });

    it('rejects invalid amount format', () => {
      const fixture = {
        type: 'invoice',
        amount: '150,00', // comma instead of dot
        asset: 'USDC',
        recipient: VALID_ADDRESS,
        dueDate: '2026-12-31T23:59:59Z',
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid amount format');
      }
    });

    it('rejects invalid asset', () => {
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'BTC', // not XLM or USDC
        recipient: VALID_ADDRESS,
        dueDate: '2026-12-31T23:59:59Z',
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
    });

    it('rejects invalid due date', () => {
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'XLM',
        recipient: VALID_ADDRESS,
        dueDate: 'not-a-date',
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid due date format');
      }
    });

    // Issue #1271 — a well-formed but past dueDate previously passed schema
    // validation (only Date.parse's NaN check ran, no >= now comparison).
    it('rejects a well-formed dueDate that is in the past', () => {
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'XLM',
        recipient: VALID_ADDRESS,
        dueDate: '2020-01-01T00:00:00Z',
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Due date must not be in the past');
      }
    });

    it('rejects a dueDate of yesterday', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'XLM',
        recipient: VALID_ADDRESS,
        dueDate: yesterday,
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Due date must not be in the past');
      }
    });

    it('accepts a dueDate of tomorrow', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'XLM',
        recipient: VALID_ADDRESS,
        dueDate: tomorrow,
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(true);
    });

    it('accepts an @username handle as the recipient', () => {
      const fixture = {
        type: 'invoice',
        amount: '500',
        asset: 'XLM',
        recipient: VALID_HANDLE,
        dueDate: '2027-01-01',
      };
      const result = parseInvoiceIntent(fixture);
      expect(result).toEqual(fixture);
    });

    // Issue #1210 — a display name is not a payable identifier. These three
    // previously passed and were the bug: an invoice addressed to a name has
    // nothing to bill. Multilingual *names* now belong in a display field, not
    // in `recipient`, which must be an address or a handle.
    it.each([
      ['Japanese', 'こんにちは (Konnichiwa) Inc.'],
      ['Spanish', 'Ramón Núñez S.A.'],
      ['Arabic', 'شركة الأمل'],
    ])('rejects a %s display name as the recipient', (_language, recipient) => {
      const result = InvoiceIntentSchema.safeParse({
        type: 'invoice',
        amount: '350.75',
        asset: 'XLM',
        recipient,
        dueDate: '2027-01-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Recipient must be a Stellar address (G...) or an @username handle'
        );
      }
    });

    it('rejects partial invoice with missing due date', () => {
      const fixture = {
        type: 'invoice',
        amount: '100',
        asset: 'USDC',
        recipient: VALID_ADDRESS,
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
    });

    it('rejects partial invoice with missing recipient', () => {
      const fixture = {
        type: 'invoice',
        amount: '100',
        asset: 'USDC',
        dueDate: '2026-12-01',
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
    });
  });

  describe('Integration with Intent Router', () => {
    const app = createApp();

    it('returns 200 for valid invoice intent', async () => {
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'USDC',
        recipient: VALID_ADDRESS,
        dueDate: '2026-12-31T23:59:59Z',
      };
      const res = await request(app)
        .post('/v1/intents/validate')
        .set('x-api-key', TEST_API_KEY)
        .send(fixture);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.intent).toEqual(fixture);
    });

    it('returns 400 with field errors for invalid JSON', async () => {
      const fixture = {
        type: 'invoice',
        amount: 'abc', // invalid
        asset: 'USDC',
        recipient: VALID_ADDRESS,
        dueDate: '2026-12-31T23:59:59Z',
      };
      const res = await request(app)
        .post('/v1/intents/validate')
        .set('x-api-key', TEST_API_KEY)
        .send(fixture);
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.fieldErrors).toBeDefined();
      expect(res.body.errors.fieldErrors.amount).toBeDefined();
    });
  });
});
