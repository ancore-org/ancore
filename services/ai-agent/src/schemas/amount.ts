import { z } from 'zod';

export const MAX_AMOUNT_VALUE = 1_000_000_000_000_000;
export const AMOUNT_FORMAT_REGEX = /^\d+(\.\d+)?$/;

export const amountStringSchema = z
  .string()
  .min(1, 'Amount is required')
  .refine((value) => AMOUNT_FORMAT_REGEX.test(value), {
    message: 'Invalid amount format',
  })
  .refine((value) => Number(value) > 0, {
    message: 'Amount must be greater than zero',
  })
  .refine((value) => Number(value) <= MAX_AMOUNT_VALUE, {
    message: 'Amount is too large',
  })
  .refine((value) => {
    const [, fractionalPart = ''] = value.split('.');
    return fractionalPart.length <= 7;
  }, {
    message: 'Amount must not exceed 7 decimal places',
  });
