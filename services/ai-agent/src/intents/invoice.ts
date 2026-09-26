import { z } from 'zod';
import { amountStringSchema } from '../schemas/amount';
import { createRecipientSchema } from '../schemas/recipient';

/**
 * Invoice intent schema validates requests to create invoices.
 */
export const InvoiceIntentSchema = z.object({
  type: z.literal('invoice'),
  amount: amountStringSchema,
  asset: z.enum(['XLM', 'USDC']),
  /**
   * A checksum-valid Stellar address, or an `@username` handle that
   * ../recipients.ts resolves to one before the draft is returned (#1210).
   * Previously any non-empty string, including a bare display name.
   */
  recipient: createRecipientSchema('Recipient'),
  /**
   * Original `@handle` when `recipient` was resolved from one. Absent when
   * the caller supplied an address directly.
   */
  resolvedFrom: z.string().optional(),
  dueDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid due date format',
    })
    .refine((date) => Date.parse(date) >= Date.now(), {
      message: 'Due date must not be in the past',
    }),
});

export type InvoiceIntent = z.infer<typeof InvoiceIntentSchema>;

/**
 * Helper to parse and validate unknown input as an invoice intent.
 */
export function parseInvoiceIntent(data: unknown): InvoiceIntent {
  return InvoiceIntentSchema.parse(data);
}
