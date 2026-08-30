import { InvoiceClient, InvoiceClientError } from '../invoice-client';
import type { Invoice } from '@ancore/types';

const sampleInvoice: Invoice = {
  id: '11111111-1111-1111-1111-111111111111',
  accountAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  recipientAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  amount: '25',
  asset: 'XLM',
  status: 'draft',
  createdAt: '2099-01-01T00:00:00.000Z',
  updatedAt: '2099-01-01T00:00:00.000Z',
};

describe('InvoiceClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates an invoice with an auth token attached', async () => {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://relayer.test/invoices');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)?.Authorization).toBe('Bearer token-123');
      return new Response(JSON.stringify(sampleInvoice), { status: 201 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new InvoiceClient({
      baseUrl: 'http://relayer.test',
      getAuthToken: () => 'token-123',
    });

    const created = await client.create({
      accountAddress: sampleInvoice.accountAddress,
      recipientAddress: sampleInvoice.recipientAddress,
      amount: sampleInvoice.amount,
      asset: sampleInvoice.asset,
    });

    expect(created.id).toBe(sampleInvoice.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports an async getAuthToken and omits the header when no token is returned', async () => {
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)?.Authorization).toBeUndefined();
      return new Response(JSON.stringify(sampleInvoice), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new InvoiceClient({
      baseUrl: 'http://relayer.test',
      getAuthToken: async () => '',
    });

    await client.get(sampleInvoice.id);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://relayer.test/invoices/${sampleInvoice.id}`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('lists invoices by creator and by recipient with encoded query params', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      return new Response(JSON.stringify({ invoices: [sampleInvoice], total: 1 }), {
        status: 200,
        headers: { 'x-requested-url': url },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new InvoiceClient({ baseUrl: 'http://relayer.test' });

    const byCreator = await client.listByCreator('G AB');
    expect(byCreator.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://relayer.test/invoices?creator=G%20AB',
      expect.anything()
    );

    await client.listByRecipient('G CD');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://relayer.test/invoices?recipient=G%20CD',
      expect.anything()
    );
  });

  it('drives the lifecycle transitions: open, pay, cancel, expire', async () => {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/open')) {
        return new Response(
          JSON.stringify({ id: sampleInvoice.id, status: 'open', openedAt: 'now' }),
          { status: 200 }
        );
      }
      if (url.endsWith('/pay')) {
        expect(JSON.parse(init?.body as string)).toEqual({ paymentTxHash: 'txhash-1' });
        return new Response(
          JSON.stringify({
            id: sampleInvoice.id,
            status: 'paid',
            paidAt: 'now',
            paymentTransactionId: 'txhash-1',
          }),
          { status: 200 }
        );
      }
      if (url.endsWith('/cancel')) {
        return new Response(
          JSON.stringify({ id: sampleInvoice.id, status: 'cancelled', cancelledAt: 'now' }),
          { status: 200 }
        );
      }
      if (url.endsWith('/expire')) {
        return new Response(
          JSON.stringify({ id: sampleInvoice.id, status: 'expired', expiredAt: 'now' }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new InvoiceClient({ baseUrl: 'http://relayer.test' });

    expect((await client.open(sampleInvoice.id)).status).toBe('open');
    expect(
      (await client.pay({ invoiceId: sampleInvoice.id, paymentTxHash: 'txhash-1' })).status
    ).toBe('paid');
    expect((await client.cancel(sampleInvoice.id)).status).toBe('cancelled');
    expect((await client.expire(sampleInvoice.id)).status).toBe('expired');
  });

  it('builds a shareable payment link from an explicit app base URL', () => {
    const client = new InvoiceClient({ baseUrl: 'http://relayer.test' });
    expect(client.buildPaymentLink(sampleInvoice.id, 'https://app.ancore.io')).toBe(
      `https://app.ancore.io/invoices/${sampleInvoice.id}/pay`
    );
  });

  it('falls back to an empty base when no app base URL or global location is available', () => {
    const client = new InvoiceClient({ baseUrl: 'http://relayer.test' });
    expect(client.buildPaymentLink(sampleInvoice.id)).toBe(`/invoices/${sampleInvoice.id}/pay`);
  });

  it('throws an InvoiceClientError with the server message on a non-OK response', async () => {
    const fetchMock = jest.fn(
      async () => new Response(JSON.stringify({ message: 'Invoice not found' }), { status: 404 })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new InvoiceClient({ baseUrl: 'http://relayer.test' });

    await expect(client.get('missing-id')).rejects.toMatchObject({
      message: 'Invoice not found',
      statusCode: 404,
    });
    await expect(client.get('missing-id')).rejects.toBeInstanceOf(InvoiceClientError);
  });

  it('falls back to a generic error message when the error response body is unparsable', async () => {
    const fetchMock = jest.fn(async () => new Response('not json', { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new InvoiceClient({ baseUrl: 'http://relayer.test' });

    await expect(client.get('x')).rejects.toMatchObject({
      message: 'InvoiceClient: GET /invoices/x failed (500)',
      statusCode: 500,
    });
  });
});
