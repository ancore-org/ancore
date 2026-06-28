import request from 'supertest';
import { createApp } from '../server';
import { parseInvoiceIntent, InvoiceIntentSchema } from '../intents/invoice';

describe('Invoice Intent Schema and Validation', () => {
  describe('Schema Validation', () => {
    it('validates a complete and correct invoice intent', () => {
      const fixture = {
        type: 'invoice',
        amount: '150.00',
        asset: 'USDC',
        recipient: 'Alice',
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
        recipient: 'Alice',
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
        recipient: 'Alice',
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
        recipient: 'Bob',
        dueDate: 'not-a-date',
      };
      const result = InvoiceIntentSchema.safeParse(fixture);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid due date format');
      }
    });

    it('validates multilingual recipient and typical data', () => {
      const fixture = {
        type: 'invoice',
        amount: '500',
        asset: 'XLM',
        recipient: 'こんにちは (Konnichiwa) Inc.',
        dueDate: '2027-01-01',
      };
      const result = parseInvoiceIntent(fixture);
      expect(result).toEqual(fixture);
    });

    it('validates Spanish multilingual recipient', () => {
      const fixture = {
        type: 'invoice',
        amount: '25.50',
        asset: 'USDC',
        recipient: 'Ramón Núñez S.A.',
        dueDate: '2026-11-30',
      };
      const result = parseInvoiceIntent(fixture);
      expect(result).toEqual(fixture);
    });

    it('validates Arabic multilingual recipient', () => {
      const fixture = {
        type: 'invoice',
        amount: '350.75',
        asset: 'XLM',
        recipient: 'شركة الأمل',
        dueDate: '2026-10-15',
      };
      const result = parseInvoiceIntent(fixture);
      expect(result).toEqual(fixture);
    });

    it('rejects partial invoice with missing due date', () => {
      const fixture = {
        type: 'invoice',
        amount: '100',
        asset: 'USDC',
        recipient: 'Bob',
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
        recipient: 'Alice',
        dueDate: '2026-12-31T23:59:59Z',
      };
      const res = await request(app).post('/v1/intents/validate').send(fixture);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.intent).toEqual(fixture);
    });

    it('returns 400 with field errors for invalid JSON', async () => {
      const fixture = {
        type: 'invoice',
        amount: 'abc', // invalid
        asset: 'USDC',
        recipient: 'Alice',
        dueDate: '2026-12-31T23:59:59Z',
      };
      const res = await request(app).post('/v1/intents/validate').send(fixture);
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.fieldErrors).toBeDefined();
      expect(res.body.errors.fieldErrors.amount).toBeDefined();
    });
  });
});
