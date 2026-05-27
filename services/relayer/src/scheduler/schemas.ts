import { z } from 'zod';

const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar public key (G...)');

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const scheduleFrequencySchema = z.enum(['once', 'daily', 'weekly', 'monthly']);

export const relayPayloadSchema = z.object({
  sessionKey: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]+$/),
  operation: z.enum(['relay_execute', 'add_session_key', 'revoke_session_key']),
  parameters: z.record(z.unknown()),
  signature: z
    .string()
    .length(128)
    .regex(/^[0-9a-fA-F]+$/),
  nonce: z.number().int().nonnegative(),
});

export const createScheduledTransferSchema = z
  .object({
    accountAddress: stellarAddressSchema,
    to: stellarAddressSchema,
    amount: z.string().min(1),
    asset: z.string().min(1).default('XLM'),
    frequency: scheduleFrequencySchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema.optional(),
    note: z.string().max(140).optional(),
    userApproved: z.literal(true, {
      errorMap: () => ({ message: 'Explicit user approval is required' }),
    }),
    relayPayload: relayPayloadSchema,
  })
  .refine((data) => new Date(data.startAt).getTime() >= Date.now() - 60_000, {
    message: 'startAt must be in the future',
    path: ['startAt'],
  });

export type CreateScheduledTransferInput = z.infer<typeof createScheduledTransferSchema>;

export type RelayPayload = z.infer<typeof relayPayloadSchema>;

export interface ScheduledTransfer {
  id: string;
  accountId: string;
  callerId: string;
  to: string;
  amount: string;
  asset: string;
  frequency: z.infer<typeof scheduleFrequencySchema>;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  startAt: string;
  nextRunAt: string;
  endAt?: string;
  note?: string;
  userApprovedAt: string;
  relayPayload: RelayPayload;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
  lastExecutionAt?: string;
}

export interface ScheduledTransferExecutionLog {
  id: string;
  scheduledTransferId: string;
  executedAt: string;
  outcome: 'success' | 'failed';
  transactionId?: string;
  error?: string;
}

export type ScheduleFrequency = z.infer<typeof scheduleFrequencySchema>;
export type ScheduledTransferStatus = ScheduledTransfer['status'];
export type ScheduledExecutionOutcome = ScheduledTransferExecutionLog['outcome'];
