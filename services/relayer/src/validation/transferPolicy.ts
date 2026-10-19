import { StrKey } from '@stellar/stellar-sdk';
import { validateTransferPolicy, type TransferPolicy } from '@ancore/types';
import type { RelayError } from '../types';
import { RelayErrorCodes } from '../types';

const NATIVE_CODES = new Set(['XLM', 'native']);
const ASSET_CODE_RE = /^[a-zA-Z0-9]{1,12}$/;

/**
 * Returns true for valid Stellar asset codes: 'XLM', 'native', or 1-12
 * alphanumeric characters. Rejects spaces, emoji, and special characters.
 */
export function validateAssetCode(code: string): boolean {
  if (typeof code !== 'string' || code.length === 0) return false;
  if (NATIVE_CODES.has(code)) return true;
  return ASSET_CODE_RE.test(code);
}

/**
 * Returns true if `issuer` is a valid Stellar G... public key (StrKey ed25519).
 */
export function validateIssuer(issuer: string): boolean {
  if (typeof issuer !== 'string' || !issuer.startsWith('G')) return false;
  try {
    return StrKey.isValidEd25519PublicKey(issuer);
  } catch {
    return false;
  }
}

export interface TransferValidationContext {
  amount: number;
  todayTotal: number;
  policy: TransferPolicy;
  /** Asset code shown in policy denial messages. Defaults to XLM. */
  assetCode?: string;
  /**
   * True only after the caller has completed the extra confirmation the
   * step-up tier requires. Absent or false leaves the transfer blocked.
   */
  stepUpConfirmed?: boolean;
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
  const result = validateTransferPolicy(
    context.amount,
    context.todayTotal,
    context.policy,
    context.assetCode
  );

  if (result.action === 'block') {
    return {
      valid: false,
      error: {
        code: RelayErrorCodes.POLICY_DENIED,
        message: result.message,
      },
    };
  }

  if (result.action === 'step_up') {
    if (context.stepUpConfirmed === true) {
      return { valid: true };
    }
    return {
      valid: false,
      requiresStepUp: true,
      error: {
        code: RelayErrorCodes.POLICY_DENIED,
        message: result.message,
      },
    };
  }

  return { valid: true };
}
