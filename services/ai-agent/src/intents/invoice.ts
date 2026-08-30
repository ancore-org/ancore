import { z } from 'zod';
import { amountStringSchema } from '../schemas/amount';

/**
 * Invoice intent schema validates requests to create invoices.
 */
export const InvoiceIntentSchema = z.object({
  type: z.literal('invoice'),
  amount: amountStringSchema,
  asset: z.enum(['XLM', 'USDC']),
  recipient: z.string().min(1, 'Recipient is required'),
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
