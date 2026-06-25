import {
  HttpSchedulerClient,
  createSchedulerClient,
  getSchedulerClient,
  resetSchedulerClientForTests,
  buildDefaultRelayPayload,
  toIsoStartAt,
  defaultScheduleStartAt,
  resolveRelayerBaseUrl,
  DEMO_ACCOUNT_ADDRESS,
  SCHEDULE_FREQUENCY_OPTIONS,
} from '../scheduler-client';

describe('resolveRelayerBaseUrl', () => {
  it('returns explicit URL stripped of trailing slash', () => {
    expect(resolveRelayerBaseUrl('https://relayer.example.com/')).toBe(
      'https://relayer.example.com'
    );
  });

  it('falls back to localhost when no argument given', () => {
    expect(resolveRelayerBaseUrl()).toBe('http://localhost:3000');
  });
});

describe('getSchedulerClient / resetSchedulerClientForTests', () => {
  beforeEach(() => {
    resetSchedulerClientForTests();
  });

  it('returns a shared singleton when called with no options', () => {
    const a = getSchedulerClient();
    const b = getSchedulerClient();
    expect(a).toBe(b);
  });

  it('returns a fresh client when options are provided', () => {
    const a = getSchedulerClient();
    const b = getSchedulerClient({ baseUrl: 'http://custom.test' });
    expect(a).not.toBe(b);
  });

  it('resets singleton so next call creates a new instance', () => {
    const a = getSchedulerClient();
    resetSchedulerClientForTests();
    const b = getSchedulerClient();
    expect(a).not.toBe(b);
  });
});

describe('buildDefaultRelayPayload', () => {
  it('returns a payload with expected shape', () => {
    const payload = buildDefaultRelayPayload('GDEST...', '100');
    expect(payload.operation).toBe('relay_execute');
    expect(payload.parameters.to).toBe('GDEST...');
    expect(payload.parameters.amount).toBe('100');
    expect(payload.parameters.asset).toBe('XLM');
    expect(payload.sessionKey).toHaveLength(64);
    expect(payload.signature).toHaveLength(128);
    expect(typeof payload.nonce).toBe('number');
  });
});

describe('toIsoStartAt', () => {
  it('converts local datetime string to ISO format', () => {
    const result = toIsoStartAt('2025-06-25T10:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('defaultScheduleStartAt', () => {
  it('returns an ISO datetime string approximately 1 hour in the future', () => {
    const now = Date.now();
    const result = defaultScheduleStartAt();
    expect(typeof result).toBe('string');
    // Format: YYYY-MM-DDTHH:MM (no seconds — truncated to minute boundary)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const resultMs = new Date(result).getTime();
    // Allow up to 1 minute behind now (truncation) but must be well under 2 hours ahead
    expect(resultMs).toBeGreaterThan(now - 60_000);
    expect(resultMs).toBeLessThan(now + 2 * 60 * 60 * 1000);
  });
});

describe('SCHEDULE_FREQUENCY_OPTIONS', () => {
  it('contains all four frequency options', () => {
    const values = SCHEDULE_FREQUENCY_OPTIONS.map((o) => o.value);
    expect(values).toContain('once');
    expect(values).toContain('daily');
    expect(values).toContain('weekly');
    expect(values).toContain('monthly');
  });
});

describe('DEMO_ACCOUNT_ADDRESS', () => {
  it('is a non-empty string', () => {
    expect(typeof DEMO_ACCOUNT_ADDRESS).toBe('string');
    expect(DEMO_ACCOUNT_ADDRESS.length).toBeGreaterThan(0);
  });
});

describe('HttpSchedulerClient — error and edge cases', () => {
  const makeClient = (fetchImpl: typeof fetch) =>
    new HttpSchedulerClient({ baseUrl: 'http://relayer.test', fetchImpl });

  it('throws when server returns non-ok with JSON error body', async () => {
    const fetchImpl = jest.fn(
      async () => new Response(JSON.stringify({ message: 'not found' }), { status: 404 })
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    await expect(client.getScheduledTransfer('missing-id')).rejects.toThrow('not found');
  });

  it('throws with status code when error body is not parseable', async () => {
    const fetchImpl = jest.fn(
      async () => new Response('bad gateway', { status: 502 })
    ) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    await expect(client.getScheduledTransfer('x')).rejects.toThrow('502');
  });

  it('pauseScheduledTransfer sends PATCH to correct URL', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      capturedUrl = url as string;
      capturedMethod = init?.method ?? '';
      return new Response(JSON.stringify({ data: { id: 'abc' } }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    await client.pauseScheduledTransfer('abc');
    expect(capturedUrl).toContain('/abc/pause');
    expect(capturedMethod).toBe('PATCH');
  });

  it('cancelScheduledTransfer sends PATCH to correct URL', async () => {
    let capturedUrl = '';
    const fetchImpl = jest.fn(async (url: string) => {
      capturedUrl = url as string;
      return new Response(JSON.stringify({ data: { id: 'abc' } }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = makeClient(fetchImpl);
    await client.cancelScheduledTransfer('abc');
    expect(capturedUrl).toContain('/abc/cancel');
  });
});
