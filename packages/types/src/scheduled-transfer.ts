/**
 * Scheduled and recurring transfer types for off-chain orchestration.
 */

import { z } from 'zod';

export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

export type ScheduledTransferStatus = 'active' | 'paused' | 'cancelled' | 'completed';

export type ScheduledExecutionOutcome = 'success' | 'failed';

const stellarAddressSchema = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar public key (G...)');

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const scheduleFrequencySchema = z.enum(['once', 'daily', 'weekly', 'monthly']);

export const scheduledTransferStatusSchema = z.enum([
  'active',
  'paused',
  'cancelled',
  'completed',
]);

export const scheduledExecutionOutcomeSchema = z.enum(['success', 'failed']);

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
  .refine(
    (data) => new Date(data.startAt).getTime() >= Date.now() - 60_000,
    { message: 'startAt must be in the future', path: ['startAt'] }
  );

export interface ScheduledTransfer {
  id: string;
  accountId: string;
  callerId: string;
  to: string;
  amount: string;
  asset: string;
  frequency: ScheduleFrequency;
  status: ScheduledTransferStatus;
  startAt: string;
  nextRunAt: string;
  endAt?: string;
  note?: string;
  userApprovedAt: string;
  relayPayload: z.infer<typeof relayPayloadSchema>;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
  lastExecutionAt?: string;
}

export interface ScheduledTransferExecutionLog {
  id: string;
  scheduledTransferId: string;
  executedAt: string;
  outcome: ScheduledExecutionOutcome;
  transactionId?: string;
  error?: string;
}

export type CreateScheduledTransferInput = z.infer<typeof createScheduledTransferSchema>;

export const ScheduledTransferSchema = z.object({
  id: z.string().uuid(),
  accountId: stellarAddressSchema,
  callerId: z.string().min(1),
  to: stellarAddressSchema,
  amount: z.string(),
  asset: z.string(),
  frequency: scheduleFrequencySchema,
  status: scheduledTransferStatusSchema,
  startAt: isoDateTimeSchema,
  nextRunAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema.optional(),
  note: z.string().optional(),
  userApprovedAt: isoDateTimeSchema,
  relayPayload: relayPayloadSchema,
  consecutiveFailures: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastExecutionAt: isoDateTimeSchema.optional(),
});

export const ScheduledTransferExecutionLogSchema = z.object({
  id: z.string().uuid(),
  scheduledTransferId: z.string().uuid(),
  executedAt: isoDateTimeSchema,
  outcome: scheduledExecutionOutcomeSchema,
  transactionId: z.string().optional(),
  error: z.string().optional(),
});
