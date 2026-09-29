import { ValidationResult } from '@ancore/types';

// ... existing imports ...

export async function validateRelay(
  relayRequest: RelayRequest,
  policyResult: TransferValidationResult,
): Promise<ValidationResult> {
  if (policyResult.action === 'block') {
    return { valid: false };
  }

  if (policyResult.action === 'step_up') {
    return { valid: false, requiresStepUp: true };
  }

  return { valid: true };
}
