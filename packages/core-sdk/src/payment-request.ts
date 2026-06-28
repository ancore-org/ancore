import {
  PaymentRequestValidationError,
  InvalidAmountError,
  assertValidEd25519PublicKey,
  StrKeyValidationError,
} from './errors';
import { normalizeAmount } from './amount';

/**
 * Represents a standardized request for payment that can be parsed from
 * external sources (QR codes, deep links, or API responses).
 */
export interface PaymentRequest {
  /**
   * The destination Stellar account address (G...).
   * Must be a valid Ed25519 public key.
   */
  destination: string;

  /**
   * The amount to be paid as a string.
   * Represented as a string to avoid floating point precision issues.
   */
  amount: string;

  /**
   * The asset to be used for the payment.
   * If omitted or 'native', XLM will be used.
   */
  asset?: { code: string; issuer: string } | 'native';

  /**
   * Optional memo to include with the transaction.
   */
  memo?: string;

  /**
   * Optional memo type. Defaults to 'text' if memo is provided.
   */
  memoType?: 'text' | 'id' | 'hash' | 'return';

  /**
   * Optional user-friendly label for the payment (e.g., "Coffee Shop").
   */
  label?: string;

  /**
   * Optional user-friendly message describing the payment (e.g., "Order #1234").
   */
  message?: string;

  /**
   * Optional URL where the transaction should be sent after signing,
   * or where the service can be notified.
   */
  callbackUrl?: string;

  /**
   * Additional application-specific fields.
   */
  extra?: Record<string, unknown>;
}

/**
 * Validates and normalizes a raw payment request payload.
 *
 * This utility ensures that the payload contains all required fields in the
 * correct format and strips out any unrecognized fields unless they are
 * explicitly placed in the `extra` object.
 *
 * @param payload - The raw payload to parse (e.g., from a JSON API).
 * @returns A validated and normalized PaymentRequest.
 * @throws {PaymentRequestValidationError} if the payload is invalid or malformed.
 */
export function parsePaymentRequest(payload: unknown): PaymentRequest {
  if (!payload || typeof payload !== 'object') {
    throw new PaymentRequestValidationError('Payment request payload must be an object.');
  }

  const raw = payload as Record<string, unknown>;

  // 1. Destination validation
  const destination = raw.destination;
  if (typeof destination !== 'string') {
    throw new PaymentRequestValidationError(
      'destination is required and must be a valid Stellar public key.'
    );
  }
  try {
    assertValidEd25519PublicKey(destination);
  } catch (err) {
    if (err instanceof StrKeyValidationError) {
      throw new PaymentRequestValidationError(err.message);
    }
    throw err;
  }

  // 2. Amount validation
  const amount = raw.amount;
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    throw new PaymentRequestValidationError('amount is required and must be a string or number.');
  }

  let normalizedAmount: string;
  try {
    normalizedAmount = normalizeAmount(amount);
  } catch (error) {
    if (error instanceof InvalidAmountError) {
      throw new PaymentRequestValidationError(error.message);
    }
    throw error;
  }

  // 3. Asset validation & normalization
  let asset: PaymentRequest['asset'] = 'native';
  if (raw.asset) {
    if (raw.asset === 'native') {
      asset = 'native';
    } else if (typeof raw.asset === 'object') {
      const a = raw.asset as Record<string, unknown>;
      if (typeof a.code !== 'string' || typeof a.issuer !== 'string') {
        throw new PaymentRequestValidationError(
          'Asset object must contain "code" and "issuer" strings.'
        );
      }
      try {
        assertValidEd25519PublicKey(a.issuer);
      } catch (err) {
        if (err instanceof StrKeyValidationError) {
          throw new PaymentRequestValidationError(
            'Asset issuer must be a valid Stellar public key.'
          );
        }
        throw err;
      }
      asset = { code: a.code, issuer: a.issuer };
    } else {
      throw new PaymentRequestValidationError('Asset must be "native" or an asset object.');
    }
  }

  // 4. Memo validation
  const memo = typeof raw.memo === 'string' ? raw.memo : undefined;
  const memoType =
    typeof raw.memoType === 'string' ? (raw.memoType as PaymentRequest['memoType']) : undefined;

  if (memoType && !['text', 'id', 'hash', 'return'].includes(memoType)) {
    throw new PaymentRequestValidationError('memoType must be one of: text, id, hash, return.');
  }

  // 5. Build normalized object
  const request: PaymentRequest = {
    destination,
    amount: normalizedAmount,
    asset,
  };

  if (memo) request.memo = memo;
  if (memoType) request.memoType = memoType;
  if (typeof raw.label === 'string') request.label = raw.label;
  if (typeof raw.message === 'string') request.message = raw.message;
  if (typeof raw.callbackUrl === 'string') request.callbackUrl = raw.callbackUrl;
  if (raw.extra && typeof raw.extra === 'object') {
    request.extra = raw.extra as Record<string, unknown>;
  }

  return request;
}
