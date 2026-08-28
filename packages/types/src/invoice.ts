/**
 * Invoice models for the Ancore invoice module.
 */

import { z } from 'zod';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'expired' | 'cancelled';

export type InvoicePaymentStatus = 'pending' | 'completed' | 'failed';

const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar public key (G...)');

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const invoiceStatusSchema = z.enum(['draft', 'open', 'paid', 'expired', 'cancelled']);

export const invoicePaymentStatusSchema = z.enum(['pending', 'completed', 'failed']);

export const createInvoiceSchema = z.object({
  accountAddress: stellarAddressSchema,
  recipientAddress: stellarAddressSchema,
  amount: z.string().min(1),
  asset: z.string().min(1).default('XLM'),
  description: z.string().max(500).optional(),
  dueDate: isoDateTimeSchema.optional(),
  reference: z.string().max(100).optional(),
});

export interface Invoice {
  id: string;
  accountAddress: string;
  recipientAddress: string;
  amount: string;
  asset: string;
  status: InvoiceStatus;
  description?: string;
  dueDate?: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  paymentTransactionId?: string;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  status: InvoicePaymentStatus;
  amount: string;
  asset: string;
  transactionId?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  accountAddress: stellarAddressSchema,
  recipientAddress: stellarAddressSchema,
  amount: z.string(),
  asset: z.string(),
  status: invoiceStatusSchema,
  description: z.string().optional(),
  dueDate: isoDateTimeSchema.optional(),
  reference: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  paidAt: isoDateTimeSchema.optional(),
  paymentTransactionId: z.string().optional(),
});

export const InvoicePaymentSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  status: invoicePaymentStatusSchema,
  amount: z.string(),
  asset: z.string(),
  transactionId: z.string().optional(),
  error: z.string().optional(),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.optional(),
});
