/**
 * Client-side session key policy validation (Issue #1539).
 * Mirrors contracts/account/src/validation.rs so invalid policies are caught
 * before an on-chain registration is submitted.
 */

const VALID_PERMISSIONS: readonly number[] = [0, 1, 2];

export type PolicyAmount = bigint | number | string;

export interface SessionKeyPolicy {
  /** Unix timestamp in seconds when the session key expires. */
  expiresAt: number;
  /** Permission bits (0 = send payment, 1 = execute, 2 = invoke contract) or bitmask. */
  permissions: number[] | number;
  /** Optional per-call spend cap, in the smallest unit. */
  maxAmountPerCall?: PolicyAmount | null;
  /** Optional cumulative spend cap per window, in the smallest unit. */
  cumulativeLimit?: PolicyAmount | null;
  /** Length of the cumulative spend window in seconds. */
  spendWindowSeconds?: number;
  /** Optional allowed contract IDs */
  allowedContracts?: string[];
}

export type SessionKeyPolicyErrorCode =
  | 'INVALID_EXPIRES_AT'
  | 'EXPIRED'
  | 'INVALID_PERMISSION'
  | 'DUPLICATE_PERMISSION'
  | 'INVALID_AMOUNT'
  | 'INVALID_SPEND_WINDOW'
  | 'INVALID_ALLOWED_CONTRACTS';

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

  if (!policy || typeof policy !== 'object') {
    fail('INVALID_EXPIRES_AT', 'expiresAt', 'Policy must be a valid object');
    return { valid: false, errors };
  }

  // Handle both seconds and milliseconds seamlessly
  let expiresAtSec = policy.expiresAt;
  if (typeof expiresAtSec === 'number' && expiresAtSec > 1e11) {
    expiresAtSec = Math.floor(expiresAtSec / 1000);
  }

  if (!Number.isInteger(expiresAtSec) || expiresAtSec <= 0) {
    fail(
      'INVALID_EXPIRES_AT',
      'expiresAt',
      'expiresAt must be a positive integer Unix timestamp in seconds'
    );
  } else if (expiresAtSec <= Date.now() / 1000) {
    fail('EXPIRED', 'expiresAt', 'expiresAt must be in the future');
  }

  if (Array.isArray(policy.permissions)) {
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
  } else if (
    typeof policy.permissions !== 'number' ||
    !Number.isInteger(policy.permissions) ||
    policy.permissions < 0
  ) {
    fail(
      'INVALID_PERMISSION',
      'permissions',
      'permissions must be a valid bitmask or array of permission bits'
    );
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

  if (policy.allowedContracts !== undefined) {
    if (!Array.isArray(policy.allowedContracts)) {
      fail(
        'INVALID_ALLOWED_CONTRACTS',
        'allowedContracts',
        'allowedContracts must be an array of contract IDs'
      );
    } else {
      for (const contractId of policy.allowedContracts) {
        if (!/^C[A-Z0-9]{55}$/.test(contractId)) {
          fail(
            'INVALID_ALLOWED_CONTRACTS',
            'allowedContracts',
            `Invalid contract address in allowlist: ${contractId}`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
