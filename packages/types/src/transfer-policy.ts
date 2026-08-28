import { z } from 'zod';

export const TransferPolicySchema = z
  .object({
    dailyLimit: z.number().nonnegative(),
    stepUpThreshold: z.number().nonnegative(),
  })
  .refine((policy) => policy.stepUpThreshold <= policy.dailyLimit, {
    message: 'stepUpThreshold must be less than or equal to dailyLimit',
    path: ['stepUpThreshold'],
  });

export type TransferPolicy = z.infer<typeof TransferPolicySchema>;

export const DEFAULT_TRANSFER_POLICY: TransferPolicy = {
  dailyLimit: 1000,
  stepUpThreshold: 250,
};

export type TransferPolicyAction = 'allow' | 'step_up' | 'block';

export interface TransferPolicyResult {
  action: TransferPolicyAction;
  message: string;
}

export function validateTransferPolicy(
  amount: number,
  todayTotal: number,
  policy: TransferPolicy = DEFAULT_TRANSFER_POLICY
): TransferPolicyResult {
  const normalizedAmount = Number(amount);
  const normalizedTodayTotal = Number(todayTotal);

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return { action: 'block', message: 'Transfer amount must be greater than zero.' };
  }

  if (!Number.isFinite(normalizedTodayTotal) || normalizedTodayTotal < 0) {
    return { action: 'block', message: 'Invalid daily total value.' };
  }

  if (normalizedTodayTotal + normalizedAmount > policy.dailyLimit) {
    return {
      action: 'block',
      message: `Transfer exceeds daily limit of ${policy.dailyLimit} XLM. Reduce the amount or wait until tomorrow.`,
    };
  }

  if (normalizedAmount > policy.stepUpThreshold) {
    return {
      action: 'step_up',
      message: `This transfer exceeds your step-up threshold of ${policy.stepUpThreshold} XLM and requires additional confirmation.`,
    };
  }

  return { action: 'allow', message: 'Transfer is within policy limits.' };
}
