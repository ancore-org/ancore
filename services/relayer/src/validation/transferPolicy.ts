import { validateTransferPolicy, type TransferPolicy } from '@ancore/types';
import type { RelayError } from '../types';

export interface TransferValidationContext {
  amount: number;
  todayTotal: number;
  policy: TransferPolicy;
}

export interface TransferValidationResult {
  valid: boolean;
  error?: RelayError;
  requiresStepUp?: boolean;
}

/**
 * Validates a relay request against transfer policy constraints.
 * Checks daily limit and step-up threshold requirements.
 */
export function validateTransferPolicyConstraints(
  context: TransferValidationContext
): TransferValidationResult {
  const result = validateTransferPolicy(context.amount, context.todayTotal, context.policy);

  if (result.action === 'block') {
    return {
      valid: false,
      error: {
        code: 'TRANSFER_LIMIT_EXCEEDED',
        message: result.message,
      },
    };
  }

  if (result.action === 'step_up') {
    return {
      valid: true,
      requiresStepUp: true,
    };
  }

  return { valid: true };
}
