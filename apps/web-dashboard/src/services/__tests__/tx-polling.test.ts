import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pollTransactionConfirmation, createPollController } from '../tx-polling';

// ---------------------------------------------------------------------------
// Mock fetch for Horizon/relayer calls
// ---------------------------------------------------------------------------

function mockFetchSequence(
  responses: Array<{ status: number; body: unknown }>
): ReturnType<typeof vi.fn> {
  let callIndex = 0;
  return vi.fn(() => {
    const response = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    return Promise.resolve(
      new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
}

// ---------------------------------------------------------------------------
// pollTransactionConfirmation
// ---------------------------------------------------------------------------

describe('pollTransactionConfirmation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns pending when transaction not found', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ status: 404, body: { error: 'not found' } }]));

    const result = await pollTransactionConfirmation('hash-1', {
      maxAttempts: 1,
      intervalMs: 100,
      network: 'testnet',
    });

    expect(result.status.status).toBe('pending');
  });

  it('returns confirmed when transaction is found and successful', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        {
          status: 200,
          body: {
            hash: 'hash-1',
            ledger: 100,
            created_at: '2024-01-01T00:00:00Z',
            successful: true,
          },
        },
      ])
    );

    const result = await pollTransactionConfirmation('hash-1', {
      maxAttempts: 3,
      intervalMs: 100,
      network: 'testnet',
    });

    expect(result.status.status).toBe('confirmed');
    if (result.status.status === 'confirmed') {
      expect(result.status.ledger).toBe(100);
    }
  });

  it('returns failed when transaction is found but unsuccessful', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        {
          status: 200,
          body: {
            hash: 'hash-1',
            ledger: 100,
            created_at: '2024-01-01T00:00:00Z',
            successful: false,
          },
        },
      ])
    );

    const result = await pollTransactionConfirmation('hash-1', {
      maxAttempts: 3,
      intervalMs: 100,
      network: 'testnet',
    });

    expect(result.status.status).toBe('failed');
  });

  it('returns failed after maxAttempts exceeded', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ status: 404, body: { error: 'not found' } }]));

    const result = await pollTransactionConfirmation('hash-1', {
      maxAttempts: 2,
      intervalMs: 10,
      network: 'testnet',
    });

    expect(result.status.status).toBe('failed');
    if (result.status.status === 'failed') {
      expect(result.status.error).toContain('timed out');
    }
    expect(result.attempts).toBe(2);
  });

  it('polls relayer status endpoint when isRelayerJob is true', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { status: 200, body: { status: 'pending' } },
        { status: 200, body: { status: 'confirmed', ledger: 200 } },
      ])
    );

    const result = await pollTransactionConfirmation('job-123', {
      maxAttempts: 5,
      intervalMs: 10,
      isRelayerJob: true,
      relayerBaseUrl: 'http://localhost:3000',
      getAuthToken: () => 'test-token',
    });

    expect(result.status.status).toBe('confirmed');
    expect(result.attempts).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// createPollController
// ---------------------------------------------------------------------------

describe('createPollController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops polling when stop() is called', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ status: 404, body: { error: 'not found' } }]));

    const onStatusChange = vi.fn();
    const { stop, result } = createPollController(
      'hash-1',
      { maxAttempts: 100, intervalMs: 50, network: 'testnet' },
      onStatusChange
    );

    // Let a few polls happen
    await vi.advanceTimersByTimeAsync(200);
    stop();

    // Advance one more tick so the pending sleep resolves and the loop notices stop()
    await vi.advanceTimersByTimeAsync(50);

    // Wait for the result to resolve
    const finalStatus = await result;
    expect(finalStatus.status.status).toBe('failed');
    if (finalStatus.status.status === 'failed') {
      expect(finalStatus.status.error).toContain('stopped');
    }
  });

  it('calls onStatusChange with each poll result', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { status: 404, body: { error: 'not found' } },
        {
          status: 200,
          body: {
            hash: 'hash-1',
            ledger: 100,
            created_at: '2024-01-01T00:00:00Z',
            successful: true,
          },
        },
      ])
    );

    const onStatusChange = vi.fn();
    const { result } = createPollController(
      'hash-1',
      { maxAttempts: 10, intervalMs: 50, network: 'testnet' },
      onStatusChange
    );

    await vi.advanceTimersByTimeAsync(200);
    const finalStatus = await result;

    expect(finalStatus.status.status).toBe('confirmed');
    expect(onStatusChange).toHaveBeenCalled();
  });
});
