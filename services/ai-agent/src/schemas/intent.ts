import { z } from 'zod';
import { InvoiceIntentSchema } from '../intents/invoice';
import { amountStringSchema } from './amount';
import { createRecipientSchema } from './recipient';

/**
 * Payment intent schema validates requests to transfer funds.
 */
export const paymentIntentSchema = z.object({
  type: z.literal('payment'),
  amount: amountStringSchema,
  asset: z.enum(['XLM', 'USDC']),
  /**
   * A checksum-valid Stellar address, or an `@username` handle that
   * ../recipients.ts resolves to one before the draft is returned (#1210).
   */
  destination: createRecipientSchema('Destination'),
  /**
   * Original `@handle` when `destination` was resolved from one. Absent when
   * the caller supplied an address directly.
   */
  resolvedFrom: z.string().optional(),
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
