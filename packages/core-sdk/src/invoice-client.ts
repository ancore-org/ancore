import type { Invoice, CreateInvoiceInput, InvoiceStatus } from '@ancore/types';
import { resolveRelayerBaseUrl } from './scheduler-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceClientOptions {
  /** Base URL for the Ancore relayer/API. Defaults to VITE_RELAYER_BASE_URL. */
  baseUrl?: string;
  /** Returns a bearer token to authenticate requests. */
  getAuthToken?: () => string | Promise<string>;
  /** Maximum time to wait for an invoice-service request. Defaults to 15 seconds. */
  timeoutMs?: number;
}

export interface PayInvoiceParams {
  invoiceId: string;
  /** Stellar transaction hash from the on-chain payment. */
  paymentTxHash: string;
}

export interface OpenInvoiceResult {
  id: string;
  status: InvoiceStatus;
  openedAt: string;
}

export interface PayInvoiceResult {
  id: string;
  status: 'paid';
  paidAt: string;
  paymentTransactionId: string;
}

export interface CancelInvoiceResult {
  id: string;
  status: 'cancelled';
  cancelledAt: string;
}

export interface ExpireInvoiceResult {
  id: string;
  status: 'expired';
  expiredAt: string;
}

export interface ListInvoicesResult {
  invoices: Invoice[];
  total: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class InvoiceClient {
  private readonly baseUrl: string;
  private readonly getAuthToken?: () => string | Promise<string>;
  private readonly timeoutMs: number;

  constructor(options: InvoiceClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? resolveRelayerBaseUrl();
    this.getAuthToken = options.getAuthToken;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(params: CreateInvoiceInput): Promise<Invoice> {
    return this.request<Invoice>('POST', '/invoices', params);
  }

  async get(invoiceId: string): Promise<Invoice> {
    return this.request<Invoice>('GET', `/invoices/${invoiceId}`);
  }

  async listByCreator(creatorAddress: string): Promise<ListInvoicesResult> {
    return this.request<ListInvoicesResult>(
      'GET',
      `/invoices?creator=${encodeURIComponent(creatorAddress)}`
    );
  }

  async listByRecipient(recipientAddress: string): Promise<ListInvoicesResult> {
    return this.request<ListInvoicesResult>(
      'GET',
      `/invoices?recipient=${encodeURIComponent(recipientAddress)}`
    );
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────

  /** Transitions a Draft invoice to Open. Only the creator can call this. */
  async open(invoiceId: string): Promise<OpenInvoiceResult> {
    return this.request<OpenInvoiceResult>('POST', `/invoices/${invoiceId}/open`);
  }

  /** Records an on-chain payment against an Open invoice. Only the recipient may pay. */
  async pay(params: PayInvoiceParams): Promise<PayInvoiceResult> {
    return this.request<PayInvoiceResult>('POST', `/invoices/${params.invoiceId}/pay`, {
      paymentTxHash: params.paymentTxHash,
    });
  }

  /** Cancels a Draft or Open invoice. Only the creator can call this. */
  async cancel(invoiceId: string): Promise<CancelInvoiceResult> {
    return this.request<CancelInvoiceResult>('POST', `/invoices/${invoiceId}/cancel`);
  }

  /**
   * Expires an Open invoice whose due_date has passed.
   * Anyone may call this (cron-friendly).
   */
  async expire(invoiceId: string): Promise<ExpireInvoiceResult> {
    return this.request<ExpireInvoiceResult>('POST', `/invoices/${invoiceId}/expire`);
  }

  // ── Shareable payment link ────────────────────────────────────────────────

  /**
   * Returns a shareable URL that a recipient can open to pay the invoice.
   * Useful for email / messaging.
   */
  buildPaymentLink(invoiceId: string, appBaseUrl?: string): string {
    const locationOrigin = (globalThis as { location?: { origin?: string } }).location?.origin;
    const base = appBaseUrl ?? locationOrigin ?? '';
    return `${base}/invoices/${invoiceId}/pay`;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const controller = new globalThis.AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new InvoiceClientError(
          `InvoiceClient: ${method} ${path} timed out after ${this.timeoutMs}ms`,
          408
        );
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
    }

    if (!response.ok) {
      let message = `InvoiceClient: ${method} ${path} failed (${response.status})`;
      try {
        const err = (await response.json()) as { message?: string; error?: string };
        message = err.message ?? err.error ?? message;
      } catch {
        // ignore
      }
      throw new InvoiceClientError(message, response.status);
    }

    return response.json() as Promise<T>;
  }
}

export class InvoiceClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'InvoiceClientError';
  }
}
