/**
 * Client-side session key policy validation.
 * Mirrors contracts/account/src/validation.rs so invalid policies are caught
 * before an on-chain registration is submitted.
 */

const VALID_PERMISSIONS: readonly number[] = [0, 1, 2];

export type PolicyAmount = bigint | number | string;

export interface SessionKeyPolicy {
  /** Unix timestamp in seconds when the session key expires. */
  expiresAt: number;
  /** Permission bits (0 = send payment, 1 = execute, 2 = invoke contract). */
  permissions: number[];
  /** Optional per-call spend cap, in the smallest unit. */
  maxAmountPerCall?: PolicyAmount | null;
  /** Optional cumulative spend cap per window, in the smallest unit. */
  cumulativeLimit?: PolicyAmount | null;
  /** Length of the cumulative spend window in seconds. */
  spendWindowSeconds?: number;
}

export type SessionKeyPolicyErrorCode =
  | 'INVALID_EXPIRES_AT'
  | 'EXPIRED'
  | 'INVALID_PERMISSION'
  | 'DUPLICATE_PERMISSION'
  | 'INVALID_AMOUNT'
  | 'INVALID_SPEND_WINDOW';

export interface SessionKeyPolicyValidationError {
  code: SessionKeyPolicyErrorCode;
  field: keyof SessionKeyPolicy;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: SessionKeyPolicyValidationError[];
}

function toBigInt(value: PolicyAmount): bigint | undefined {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return Number.isInteger(value) ? BigInt(value) : undefined;
    return /^-?\d+$/.test(value.trim()) ? BigInt(value.trim()) : undefined;
  } catch {
    return undefined;
  }
}

export function validateSessionKeyPolicy(policy: SessionKeyPolicy): ValidationResult {
  const errors: SessionKeyPolicyValidationError[] = [];
  const fail = (code: SessionKeyPolicyErrorCode, field: keyof SessionKeyPolicy, message: string) =>
    errors.push({ code, field, message });

  if (!Number.isInteger(policy.expiresAt) || policy.expiresAt <= 0) {
    fail(
      'INVALID_EXPIRES_AT',
      'expiresAt',
      'expiresAt must be a positive integer Unix timestamp in seconds'
    );
  } else if (policy.expiresAt <= Date.now() / 1000) {
    fail('EXPIRED', 'expiresAt', 'expiresAt must be in the future');
  }

  const seen = new Set<number>();
  let unknownReported = false;
  let duplicateReported = false;
  for (const permission of policy.permissions) {
    if (!VALID_PERMISSIONS.includes(permission)) {
      if (!unknownReported) {
        fail('INVALID_PERMISSION', 'permissions', `Unknown permission bit: ${permission}`);
        unknownReported = true;
      }
      continue;
    }
    if (seen.has(permission) && !duplicateReported) {
      fail('DUPLICATE_PERMISSION', 'permissions', `Duplicate permission bit: ${permission}`);
      duplicateReported = true;
    }
    seen.add(permission);
  }

  const checkAmount = (field: 'maxAmountPerCall' | 'cumulativeLimit') => {
    const raw = policy[field];
    if (raw === undefined || raw === null) return;
    const amount = toBigInt(raw);
    if (amount === undefined || amount <= 0n) {
      fail('INVALID_AMOUNT', field, `${field} must be a positive integer amount`);
    }
  };
  checkAmount('maxAmountPerCall');
  checkAmount('cumulativeLimit');

  const window = policy.spendWindowSeconds;
  const hasLimit = policy.cumulativeLimit !== undefined && policy.cumulativeLimit !== null;
  if (window !== undefined) {
    if (!Number.isInteger(window) || window < 0) {
      fail(
        'INVALID_SPEND_WINDOW',
        'spendWindowSeconds',
        'spendWindowSeconds must be a non-negative integer'
      );
    } else if (window > 0 && !hasLimit) {
      fail(
        'INVALID_SPEND_WINDOW',
        'spendWindowSeconds',
        'spendWindowSeconds requires cumulativeLimit'
      );
    } else if (window === 0 && hasLimit) {
      fail(
        'INVALID_SPEND_WINDOW',
        'spendWindowSeconds',
        'spendWindowSeconds must be greater than 0 when cumulativeLimit is set'
      );
    }
  } else if (hasLimit) {
    fail(
      'INVALID_SPEND_WINDOW',
      'spendWindowSeconds',
      'spendWindowSeconds must be greater than 0 when cumulativeLimit is set'
    );
  }

  return { valid: errors.length === 0, errors };
}
