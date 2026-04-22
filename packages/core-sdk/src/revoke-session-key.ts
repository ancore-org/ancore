import type { InvocationArgs } from '@ancore/account-abstraction';
import { AccountContractError } from '@ancore/account-abstraction';

import { AncoreSdkError, BuilderValidationError, SessionKeyManagementError } from './errors';

export interface RevokeSessionKeyParams {
  publicKey: string;
}

export interface SessionKeyRevoker {
  revokeSessionKey(publicKey: string): InvocationArgs;
}

const VALIDATION_ERROR_PATTERNS = [
  /invalid stellar public key/i,
  /invalid u32 value/i,
  /invalid u64 value/i,
];

export function revokeSessionKey(
  accountContract: SessionKeyRevoker,
  params: RevokeSessionKeyParams
): InvocationArgs {
  validateRevokeSessionKeyParams(params);

  try {
    return accountContract.revokeSessionKey(params.publicKey);
  } catch (error) {
    throw normalizeRevokeSessionKeyError(error);
  }
}

function validateRevokeSessionKeyParams(params: RevokeSessionKeyParams): void {
  if (!params || typeof params !== 'object') {
    throw new BuilderValidationError(
      'revokeSessionKey requires a parameter object with publicKey.'
    );
  }

  if (typeof params.publicKey !== 'string' || params.publicKey.trim().length === 0) {
    throw new BuilderValidationError('revokeSessionKey requires a non-empty publicKey string.');
  }
}

function normalizeRevokeSessionKeyError(error: unknown): AncoreSdkError {
  if (error instanceof AncoreSdkError) {
    return error;
  }

  if (error instanceof AccountContractError) {
    return new SessionKeyManagementError(error.message, error.code, error);
  }

  if (
    error instanceof Error &&
    VALIDATION_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))
  ) {
    return new BuilderValidationError(error.message);
  }

  if (error instanceof Error) {
    return new SessionKeyManagementError(
      `Failed to revoke session key: ${error.message}`,
      'SESSION_KEY_REVOKE_FAILED',
      error
    );
  }

  return new SessionKeyManagementError(
    'Failed to revoke session key due to an unknown error.',
    'SESSION_KEY_REVOKE_FAILED',
    error
  );
}
