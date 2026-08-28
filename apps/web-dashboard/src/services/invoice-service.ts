import { InvoiceClient, InvoiceClientError } from '@ancore/core-sdk';
import type {
  OpenInvoiceResult,
  PayInvoiceResult,
  CancelInvoiceResult,
  ExpireInvoiceResult,
  ListInvoicesResult,
} from '@ancore/core-sdk';
import type { Invoice, CreateInvoiceInput } from '@ancore/types';

// ---------------------------------------------------------------------------
// Module-level singleton (re-created on token change via `configure`)
// ---------------------------------------------------------------------------

let _client = new InvoiceClient();

export function configureInvoiceService(opts: { getAuthToken: () => string | Promise<string> }) {
  _client = new InvoiceClient({ getAuthToken: opts.getAuthToken });
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export async function fetchInvoice(invoiceId: string): Promise<Invoice> {
  return _client.get(invoiceId);
}

export async function fetchInvoicesByCreator(creatorAddress: string): Promise<Invoice[]> {
  const result: ListInvoicesResult = await _client.listByCreator(creatorAddress);
  return result.invoices;
}

export async function fetchInvoicesByRecipient(recipientAddress: string): Promise<Invoice[]> {
  const result: ListInvoicesResult = await _client.listByRecipient(recipientAddress);
  return result.invoices;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export async function createInvoice(params: CreateInvoiceInput): Promise<Invoice> {
  return _client.create(params);
}

export async function openInvoice(invoiceId: string): Promise<OpenInvoiceResult> {
  return _client.open(invoiceId);
}

export async function payInvoice(
  invoiceId: string,
  paymentTxHash: string
): Promise<PayInvoiceResult> {
  return _client.pay({ invoiceId, paymentTxHash });
}

export async function cancelInvoice(invoiceId: string): Promise<CancelInvoiceResult> {
  return _client.cancel(invoiceId);
}

export async function expireInvoice(invoiceId: string): Promise<ExpireInvoiceResult> {
  return _client.expire(invoiceId);
}

// ---------------------------------------------------------------------------
// Payment link helper
// ---------------------------------------------------------------------------

export function buildPaymentLink(invoiceId: string): string {
  return _client.buildPaymentLink(invoiceId);
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export function isInvoiceNotFound(err: unknown): boolean {
  return err instanceof InvoiceClientError && err.statusCode === 404;
}

export function isInvoiceConflict(err: unknown): boolean {
  return err instanceof InvoiceClientError && err.statusCode === 409;
}
