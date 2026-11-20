import { createInvoiceSchema as baseSchema } from '@ancore/types';
import { z } from 'zod';

export const createInvoiceSchema = baseSchema;
export type CreateInvoiceSchemaType = z.infer<typeof createInvoiceSchema>;
