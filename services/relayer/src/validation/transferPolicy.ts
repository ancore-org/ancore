import { TransferValidationResult } from '@ancore/types';

// ... existing imports ...

export function validateTransferPolicy(
  amount: bigint,
  dailyLimit: bigint,
  stepUpThreshold: bigint,
): TransferValidationResult {
  if (amount >= dailyLimit) {
    return { action: 'block' };
  }

  if (amount >= stepUpThreshold) {
    return { action: 'step_up' };
  }

  return { action: 'allow' };
}
