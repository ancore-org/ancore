import type { InvocationArgs } from '@ancore/account-abstraction';
import { AccountContractError } from '@ancore/account-abstraction';
import type { SessionPermission } from '@ancore/types';

import { AncoreSdkError, BuilderValidationError, SessionKeyManagementError } from './errors';

export interface AddSessionKeyParams {
  publicKey: string;
  permissions: SessionPermission[];
  expiresAt: number;
}

export interface SessionKeyWriter {
  addSessionKey(publicKey: string, permissions: number[], expiresAt: number): InvocationArgs;
}

const VALIDATION_ERROR_PATTERNS = [
  /invalid stellar public key/i,
  /invalid u32 value/i,
  /invalid u64 value/i,
  /permissions must/i,
];

export function addSessionKey(
  accountContract: SessionKeyWriter,
  params: AddSessionKeyParams
): InvocationArgs {
  validateAddSessionKeyParams(params);

  try {
    return accountContract.addSessionKey(params.publicKey, params.permissions, params.expiresAt);
  } catch (error) {
    throw normalizeAddSessionKeyError(error);
  }
}

function validateAddSessionKeyParams(params: AddSessionKeyParams): void {
  if (!params || typeof params !== 'object') {
    throw new BuilderValidationError(
      'addSessionKey requires a parameter object with publicKey, permissions, and expiresAt.'
    );
  }

  if (typeof params.publicKey !== 'string' || params.publicKey.trim().length === 0) {
    throw new BuilderValidationError('addSessionKey requires a non-empty publicKey string.');
  }

  if (!Array.isArray(params.permissions)) {
    throw new BuilderValidationError('addSessionKey requires permissions to be an array.');
  }

  if (typeof params.expiresAt !== 'number' || !Number.isFinite(params.expiresAt)) {
    throw new BuilderValidationError('addSessionKey requires expiresAt to be a finite number.');
  }
}

function normalizeAddSessionKeyError(error: unknown): AncoreSdkError {
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
      `Failed to add session key: ${error.message}`,
      'SESSION_KEY_ADD_FAILED',
      error
    );
  }

  return new SessionKeyManagementError(
    'Failed to add session key due to an unknown error.',
    'SESSION_KEY_ADD_FAILED',
    error
  );
}
