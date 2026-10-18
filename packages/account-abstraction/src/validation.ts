import type { SessionKeyPolicy } from '@ancore/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a SessionKeyPolicy before submitting on-chain registration.
 * Mirrors validation rules from contracts/account/src/validation.rs.
 *
 * Checks:
 * - Expiration timestamp must be strictly in the future.
 * - Spend limits (if specified) must be positive values.
 * - Non-empty and valid configuration parameters.
 */
export function validateSessionKeyPolicy(
  policy: SessionKeyPolicy,
  nowMs: number = Date.now()
): ValidationResult {
  const errors: string[] = [];

  if (!policy || typeof policy !== 'object') {
    return {
      valid: false,
      errors: ['Policy must be a valid object'],
    };
  }

  // 1. Expiration validation
  if (typeof policy.expiresAt !== 'number' || !Number.isFinite(policy.expiresAt)) {
    errors.push('expiresAt must be a valid timestamp');
  } else {
    // Check if expiresAt is in milliseconds or seconds (support both safely)
    const expiresAtMs = policy.expiresAt > 1e11 ? policy.expiresAt : policy.expiresAt * 1000;
    if (expiresAtMs <= nowMs) {
      errors.push('Session key expiration must be in the future');
    }
  }

  // 2. Permissions validation
  if (typeof policy.permissions !== 'number' || policy.permissions < 0) {
    errors.push('permissions must be a non-negative bitmask');
  }

  // 3. maxAmountPerCall validation
  if (policy.maxAmountPerCall !== undefined) {
    const amountNum = Number(policy.maxAmountPerCall);
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.push('maxAmountPerCall must be a positive numeric value');
    }
  }

  // 4. Contract allowlist validation
  if (policy.allowedContracts !== undefined) {
    if (!Array.isArray(policy.allowedContracts)) {
      errors.push('allowedContracts must be an array of contract IDs');
    } else {
      for (const contractId of policy.allowedContracts) {
        if (!/^C[A-Z0-9]{55}$/.test(contractId)) {
          errors.push(`Invalid contract address in allowlist: ${contractId}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
