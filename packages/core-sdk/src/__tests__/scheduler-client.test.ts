import {
  HttpSchedulerClient,
  createSchedulerClient,
  type SchedulerClient,
  type SchedulerClientOptions,
} from '../scheduler-client';

describe('HttpSchedulerClient', () => {
  const sampleTransfer = {
    id: '11111111-1111-1111-1111-111111111111',
    accountId: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    to: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    amount: '10',
    asset: 'XLM',
    frequency: 'once' as const,
    status: 'active' as const,
    startAt: '2099-01-01T00:00:00.000Z',
    nextRunAt: '2099-01-01T00:00:00.000Z',
    userApprovedAt: '2099-01-01T00:00:00.000Z',
    relayPayload: {
      sessionKey: 'a'.repeat(64),
      operation: 'relay_execute' as const,
      parameters: {},
      signature: 'b'.repeat(128),
      nonce: 1,
    },
    createdAt: '2099-01-01T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
  };

  it('creates and lists scheduled transfers over HTTP', async () => {
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/v1/scheduled-transfers') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: sampleTransfer }), { status: 201 });
      }

      if (url.includes('/api/v1/scheduled-transfers?')) {
        return new Response(JSON.stringify({ data: [sampleTransfer] }), { status: 200 });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const client = createSchedulerClient({
      baseUrl: 'http://relayer.test',
      getAuthToken: () => 'token-123',
      fetchImpl,
    });

    const created = await client.createScheduledTransfer({
      accountAddress: sampleTransfer.accountId,
      to: sampleTransfer.to,
      amount: sampleTransfer.amount,
      asset: 'XLM',
      frequency: 'once',
      startAt: sampleTransfer.startAt,
      userApproved: true,
      relayPayload: sampleTransfer.relayPayload,
    });

    expect(created.id).toBe(sampleTransfer.id);
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://relayer.test/api/v1/scheduled-transfers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );

    const listed = await client.listScheduledTransfers(sampleTransfer.accountId);
    expect(listed).toHaveLength(1);
  });

  it('loads execution logs for a scheduled transfer', async () => {
    const execution = {
      id: '22222222-2222-2222-2222-222222222222',
      scheduledTransferId: sampleTransfer.id,
      executedAt: '2099-01-02T00:00:00.000Z',
      outcome: 'success' as const,
      transactionId: 'ABCDEF',
    };

    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith('/executions')) {
        return new Response(JSON.stringify({ data: [execution] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const client = new HttpSchedulerClient({
      baseUrl: 'http://relayer.test',
      fetchImpl,
    });

    const logs = await client.listExecutions(sampleTransfer.id);
    expect(logs[0]?.outcome).toBe('success');
  });
});
