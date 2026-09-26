import {
  intentSchema,
  paymentIntentSchema,
  HIGH_VALUE_PAYMENT_THRESHOLD,
} from '../src/schemas/intent';
import { VALID_ADDRESS } from '../src/__tests__/fixtures/addresses';

describe('Intent Schema Validation', () => {
  describe('Payment Intent', () => {
    it('should accept valid payment intent', () => {
      const intent = {
        type: 'payment' as const,
        amount: '100.50',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });

    it('should accept integer amounts', () => {
      const intent = {
        type: 'payment' as const,
        amount: '1000',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });

    it('should accept USDC asset', () => {
      const intent = {
        type: 'payment' as const,
        amount: '50',
        asset: 'USDC' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });

    it('should reject invalid amount format', () => {
      const intent = {
        type: 'payment' as const,
        amount: 'invalid-amount',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should reject zero amounts', () => {
      const intent = {
        type: 'payment' as const,
        amount: '0',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should reject negative-like amounts', () => {
      const intent = {
        type: 'payment' as const,
        amount: '-1',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should reject amounts with too many decimal places', () => {
      const intent = {
        type: 'payment' as const,
        amount: '1.123456789',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should reject very large amounts', () => {
      const intent = {
        type: 'payment' as const,
        amount: '1000000000000000000000000',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should reject unsupported asset', () => {
      const intent = {
        type: 'payment' as const,
        amount: '100',
        asset: 'EUR' as any,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should reject empty destination', () => {
      const intent = {
        type: 'payment' as const,
        amount: '100',
        asset: 'XLM' as const,
        destination: '',
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const intent = {
        amount: '100',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });

    it('should accept requiresConfirmation field when provided as true', () => {
      const intent = {
        type: 'payment' as const,
        amount: '100',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
        requiresConfirmation: true,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });

    it('should accept requiresConfirmation field when provided as false', () => {
      const intent = {
        type: 'payment' as const,
        amount: '100',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
        requiresConfirmation: false,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });

    it('should work without requiresConfirmation field (optional)', () => {
      const intent = {
        type: 'payment' as const,
        amount: '100',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });

    it('should reject invalid requiresConfirmation type', () => {
      const intent = {
        type: 'payment' as const,
        amount: '100',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
        requiresConfirmation: 'true' as any,
      };
      const result = paymentIntentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });
  });

  describe('Intent Union', () => {
    it('should validate via discriminated union', () => {
      const intent = {
        type: 'payment' as const,
        amount: '75.25',
        asset: 'USDC' as const,
        destination: VALID_ADDRESS,
      };
      const result = intentSchema.safeParse(intent);
      expect(result.success).toBe(true);
    });

    it('should reject unknown intent type', () => {
      const intent = {
        type: 'swap' as any,
        amount: '100',
        asset: 'XLM' as const,
        destination: VALID_ADDRESS,
      };
      const result = intentSchema.safeParse(intent);
      expect(result.success).toBe(false);
    });
  });

  describe('High-Value Payment Threshold', () => {
    it('should have defined threshold constant', () => {
      expect(HIGH_VALUE_PAYMENT_THRESHOLD).toBeDefined();
      expect(typeof HIGH_VALUE_PAYMENT_THRESHOLD).toBe('number');
      expect(HIGH_VALUE_PAYMENT_THRESHOLD).toBe(1000);
    });
  });
});
