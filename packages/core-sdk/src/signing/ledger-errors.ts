/**
 * Typed Ledger / WebHID errors for wallet UX mapping.
 */

export enum LedgerErrorCode {
  UNSUPPORTED = 'LEDGER_UNSUPPORTED',
  NOT_CONNECTED = 'LEDGER_NOT_CONNECTED',
  APP_NOT_OPEN = 'LEDGER_APP_NOT_OPEN',
  USER_REJECTED = 'LEDGER_USER_REJECTED',
  LOCKED = 'LEDGER_LOCKED',
  UNKNOWN = 'LEDGER_UNKNOWN',
}

export class LedgerSigningError extends Error {
  readonly code: LedgerErrorCode;
  readonly cause?: unknown;

  constructor(code: LedgerErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'LedgerSigningError';
    this.code = code;
    this.cause = cause;
  }
}

/** Map Ledger / transport errors into a stable taxonomy for UI copy. */
export function mapLedgerError(err: unknown): LedgerSigningError {
  if (err instanceof LedgerSigningError) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? Number((err as { statusCode?: number }).statusCode)
      : undefined;
  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name?: string }).name)
      : '';

  if (
    name.includes('TransportOpenUserCancelled') ||
    lower.includes('user refused') ||
    lower.includes('user rejected') ||
    lower.includes('denied by the user') ||
    statusCode === 0x6985
  ) {
    return new LedgerSigningError(
      LedgerErrorCode.USER_REJECTED,
      'Request rejected on the Ledger device',
      err
    );
  }

  if (
    lower.includes('locked device') ||
    lower.includes('device is locked') ||
    statusCode === 0x5515
  ) {
    return new LedgerSigningError(
      LedgerErrorCode.LOCKED,
      'Ledger device is locked — unlock it and try again',
      err
    );
  }

  if (
    lower.includes('app does not seem to be open') ||
    lower.includes('wrong app') ||
    lower.includes('ins_not_supported') ||
    statusCode === 0x6e00 ||
    statusCode === 0x6d00
  ) {
    return new LedgerSigningError(
      LedgerErrorCode.APP_NOT_OPEN,
      'Open the Stellar app on your Ledger device',
      err
    );
  }

  if (lower.includes('hid') && (lower.includes('not supported') || lower.includes('unavailable'))) {
    return new LedgerSigningError(
      LedgerErrorCode.UNSUPPORTED,
      'WebHID is not available in this browser context',
      err
    );
  }

  if (lower.includes('no device selected') || lower.includes('not connected')) {
    return new LedgerSigningError(LedgerErrorCode.NOT_CONNECTED, 'No Ledger device connected', err);
  }

  return new LedgerSigningError(LedgerErrorCode.UNKNOWN, message || 'Ledger signing failed', err);
}
