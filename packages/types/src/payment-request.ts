/**
 * Payment request models for the Ancore payment request flow.
 */

/** A shareable payment request created by a recipient. */
export interface PaymentRequest {
  /** Unique request identifier (UUID or random hex) */
  id: string;
  /** Stellar public key of the requester */
  requesterAddress: string;
  /** Amount requested in the asset's base unit */
  amount: string;
  /** Asset code (e.g. "XLM", "USDC") */
  assetCode: string;
  /** Optional human-readable note shown to the payer */
  note?: string;
  /** Unix timestamp (seconds) after which the request is considered expired */
  expiresAt: number;
  /** Unix timestamp (seconds) when the request was created */
  createdAt: number;
}

/** Input when creating a new payment request */
export interface CreatePaymentRequestInput {
  requesterAddress: string;
  amount: string;
  assetCode: string;
  note?: string;
  /** Duration in seconds until the request expires (default: 86400 = 24 h) */
  ttlSeconds?: number;
}

/** Serialised form embedded in the shareable URL query string */
export interface PaymentRequestPayload {
  id: string;
  to: string;
  amount: string;
  asset: string;
  note?: string;
  exp: number;
}
