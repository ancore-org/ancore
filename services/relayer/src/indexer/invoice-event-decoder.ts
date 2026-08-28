/**
 * Decodes Soroban contract events emitted by the Ancore Invoice contract.
 *
 * Event topic shape (all events):
 *   topics[0] = ScVal::Symbol("inv")
 *   topics[1] = ScVal::Symbol(<event-name>)
 *
 * Payload schemas per event type:
 *   created   → (id: BytesN<32>, creator: Address, recipient: Address, amount: i128, asset: Address, due_date: u64)
 *   opened    → (id: BytesN<32>, creator: Address)
 *   paid      → (id: BytesN<32>, payer: Address, amount: i128, asset: Address, tx: BytesN<32>)
 *   cancelled → (id: BytesN<32>, cancelled_by: Address)
 *   expired   → (id: BytesN<32>, creator: Address)
 */

import { xdr, scValToNative, Address } from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Decoded event types
// ---------------------------------------------------------------------------

export type InvoiceEventName =
  | 'invoice_created'
  | 'invoice_opened'
  | 'invoice_paid'
  | 'invoice_cancelled'
  | 'invoice_expired';

export interface InvoiceCreatedEvent {
  name: 'invoice_created';
  id: string;
  creator: string;
  recipient: string;
  amount: bigint;
  asset: string;
  dueDate: bigint;
  ledger: number;
  txHash: string;
  contractId: string;
}

export interface InvoiceOpenedEvent {
  name: 'invoice_opened';
  id: string;
  creator: string;
  ledger: number;
  txHash: string;
  contractId: string;
}

export interface InvoicePaidEvent {
  name: 'invoice_paid';
  id: string;
  payer: string;
  amount: bigint;
  asset: string;
  paymentTx: string;
  ledger: number;
  txHash: string;
  contractId: string;
}

export interface InvoiceCancelledEvent {
  name: 'invoice_cancelled';
  id: string;
  cancelledBy: string;
  ledger: number;
  txHash: string;
  contractId: string;
}

export interface InvoiceExpiredEvent {
  name: 'invoice_expired';
  id: string;
  creator: string;
  ledger: number;
  txHash: string;
  contractId: string;
}

export type DecodedInvoiceEvent =
  | InvoiceCreatedEvent
  | InvoiceOpenedEvent
  | InvoicePaidEvent
  | InvoiceCancelledEvent
  | InvoiceExpiredEvent;

// ---------------------------------------------------------------------------
// Decoder
// ---------------------------------------------------------------------------

export interface RawSorobanEvent {
  contractId: string;
  topics: xdr.ScVal[];
  body: xdr.ScVal;
  ledger: number;
  txHash: string;
}

const TOPIC_NAMESPACE = 'inv';

export function isInvoiceEvent(event: RawSorobanEvent): boolean {
  if (event.topics.length < 2) return false;
  try {
    const ns = scValToNative(event.topics[0] as xdr.ScVal);
    return ns === TOPIC_NAMESPACE;
  } catch {
    return false;
  }
}

export function decodeInvoiceEvent(event: RawSorobanEvent): DecodedInvoiceEvent | null {
  if (!isInvoiceEvent(event)) return null;

  let eventName: string;
  try {
    eventName = scValToNative(event.topics[1] as xdr.ScVal) as string;
  } catch {
    return null;
  }

  const body = scValToNative(event.body);
  if (!Array.isArray(body)) return null;

  const meta = { ledger: event.ledger, txHash: event.txHash, contractId: event.contractId };

  switch (eventName) {
    case 'created': {
      const [id, creator, recipient, amount, asset, dueDate] = body as [
        Buffer,
        string,
        string,
        bigint,
        string,
        bigint,
      ];
      return {
        name: 'invoice_created',
        id: bufferToHex(id),
        creator: normalizeAddress(creator),
        recipient: normalizeAddress(recipient),
        amount,
        asset: normalizeAddress(asset),
        dueDate,
        ...meta,
      };
    }
    case 'opened': {
      const [id, creator] = body as [Buffer, string];
      return {
        name: 'invoice_opened',
        id: bufferToHex(id),
        creator: normalizeAddress(creator),
        ...meta,
      };
    }
    case 'paid': {
      const [id, payer, amount, asset, tx] = body as [Buffer, string, bigint, string, Buffer];
      return {
        name: 'invoice_paid',
        id: bufferToHex(id),
        payer: normalizeAddress(payer),
        amount,
        asset: normalizeAddress(asset),
        paymentTx: bufferToHex(tx),
        ...meta,
      };
    }
    case 'cancelled': {
      const [id, cancelledBy] = body as [Buffer, string];
      return {
        name: 'invoice_cancelled',
        id: bufferToHex(id),
        cancelledBy: normalizeAddress(cancelledBy),
        ...meta,
      };
    }
    case 'expired': {
      const [id, creator] = body as [Buffer, string];
      return {
        name: 'invoice_expired',
        id: bufferToHex(id),
        creator: normalizeAddress(creator),
        ...meta,
      };
    }
    default:
      return null;
  }
}

/**
 * Filters a batch of raw events and returns decoded invoice events.
 * Safe to call on mixed event streams — non-invoice events are silently skipped.
 */
export function decodeInvoiceEvents(events: RawSorobanEvent[]): DecodedInvoiceEvent[] {
  return events
    .filter(isInvoiceEvent)
    .map(decodeInvoiceEvent)
    .filter((e): e is DecodedInvoiceEvent => e !== null);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufferToHex(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('hex');
}

function normalizeAddress(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val instanceof Address) return val.toString();
  return String(val);
}
