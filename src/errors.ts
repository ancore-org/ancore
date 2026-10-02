export interface AncoreErrorResponse {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

export class AncoreError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(response: AncoreErrorResponse) {
    super(response.message);
    this.name = 'AncoreError';
    this.status = response.status;
    this.code = response.code;
    this.details = response.details;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAncoreError(error: unknown): error is AncoreError {
  if (error instanceof AncoreError) {
    return true;
  }
  if (
    isObject(error) &&
    typeof error.status === 'number' &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    return true;
  }
  return false;
}

export function isRateLimitError(error: unknown): error is AncoreError {
  if (!isAncoreError(error)) {
    return false;
  }
  return error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED';
}

export function isInsufficientBalanceError(error: unknown): error is AncoreError {
  if (!isAncoreError(error)) {
    return false;
  }
  return error.status === 402 || error.code === 'INSUFFICIENT_BALANCE';
}

export function isUnauthorizedError(error: unknown): error is AncoreError {
  if (!isAncoreError(error)) {
    return false;
  }
  return error.status === 401 || error.code === 'UNAUTHORIZED';
}

export function isValidationError(error: unknown): error is AncoreError {
  if (!isAncoreError(error)) {
    return false;
  }
  return error.status === 400 || error.code === 'VALIDATION_ERROR';
}
