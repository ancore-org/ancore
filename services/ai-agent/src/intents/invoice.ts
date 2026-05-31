import { z } from 'zod';

/**
 * Invoice intent schema validates requests to create invoices.
 */
export const InvoiceIntentSchema = z.object({
  type: z.literal('invoice'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  asset: z.enum(['XLM', 'USDC']),
  recipient: z.string().min(1, 'Recipient is required'),
  dueDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid due date format',
  }),
});

export type InvoiceIntent = z.infer<typeof InvoiceIntentSchema>;

/**
 * Helper to parse and validate unknown input as an invoice intent.
 */
export function parseInvoiceIntent(data: unknown): InvoiceIntent {
  return InvoiceIntentSchema.parse(data);
}
