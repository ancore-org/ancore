import { z } from 'zod';
import { InvoiceIntentSchema } from '../intents/invoice';

/**
 * Payment intent schema validates requests to transfer funds.
 */
export const paymentIntentSchema = z.object({
  type: z.literal('payment'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  asset: z.enum(['XLM', 'USDC']),
  destination: z.string().min(1, 'Destination is required'),
  requiresConfirmation: z.boolean().optional(),
});

/**
 * Discriminated union of supported intent types.
 * Currently payment and invoice intents are supported.
 */
export const intentSchema = z.discriminatedUnion('type', [
  paymentIntentSchema,
  InvoiceIntentSchema,
]);

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type Intent = z.infer<typeof intentSchema>;

/**
 * High-value payment threshold for confirmation requirement.
 * Payments above this amount require user confirmation.
 */
export const HIGH_VALUE_PAYMENT_THRESHOLD = 1000;
