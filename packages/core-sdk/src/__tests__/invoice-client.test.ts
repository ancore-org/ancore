import type { CreateInvoiceInput } from '@ancore/types';
import { InvoiceClient, InvoiceClientError } from '../invoice-client';

describe('InvoiceClient', () => {
  const fetchMock = jest.fn();
  const createInput: CreateInvoiceInput = {
    accountAddress: `G${'A'.repeat(55)}`,
    recipientAddress: `G${'B'.repeat(55)}`,
    amount: '10',
    asset: 'XLM',
  };
  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });

  it('sends authenticated JSON requests and returns invoice data', async () => {
    const invoice = { id: 'inv_1', status: 'draft' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => invoice });
    const client = new InvoiceClient({
      baseUrl: 'https://invoice.test',
      getAuthToken: () => 'token',
    });
    await expect(client.create(createInput)).resolves.toEqual(invoice);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://invoice.test/invoices',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    );
  });

  it('maps HTTP errors to InvoiceClientError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Invalid invoice' }),
    });
    await expect(
      new InvoiceClient({ baseUrl: 'https://invoice.test' }).get('inv_1')
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'InvoiceClientError',
        statusCode: 422,
        message: 'Invalid invoice',
      })
    );
  });

  it('aborts hung requests at the configured timeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    const promise = new InvoiceClient({ baseUrl: 'https://invoice.test', timeoutMs: 10 }).get(
      'inv_1'
    );
    jest.advanceTimersByTime(10);
    await expect(promise).rejects.toBeInstanceOf(InvoiceClientError);
    jest.useRealTimers();
  });
});
