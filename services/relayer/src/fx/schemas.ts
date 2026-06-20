import { z } from 'zod';

export const assetCodeSchema = z
  .string()
  .min(1, 'Asset code must not be empty')
  .max(12, 'Asset code must be ≤ 12 chars')
  .regex(/^[a-zA-Z0-9]+$/, 'Asset code must be alphanumeric');

export const decimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a numeric string');

export const createExchangeRateSchema = z.object({
  fromAsset: assetCodeSchema,
  toAsset: assetCodeSchema,
  rate: decimalStringSchema,
});

export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;

export const createQuoteSchema = z.object({
  fromAsset: assetCodeSchema,
  toAsset: assetCodeSchema,
  amount: decimalStringSchema,
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const executeConversionSchema = z.object({
  quoteId: z.string().uuid('quoteId must be a valid UUID'),
  walletId: z.string().min(1, 'walletId must not be empty'),
});

export type ExecuteConversionInput = z.infer<typeof executeConversionSchema>;

export const listRatesQuerySchema = z.object({
  from: assetCodeSchema.optional(),
  to: assetCodeSchema.optional(),
});

export const listHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate: z.string().datetime({ offset: true }).optional(),
});

export interface ExchangeRate {
  id: string;
  fromAsset: string;
  toAsset: string;
  rate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FxQuote {
  id: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  convertedAmount: string;
  rate: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface ConversionRecord {
  id: string;
  quoteId: string;
  walletId: string;
  callerId: string;
  fromAsset: string;
  toAsset: string;
  amount: string;
  convertedAmount: string;
  rate: string;
  status: 'completed' | 'failed';
  txHash?: string;
  createdAt: string;
}
