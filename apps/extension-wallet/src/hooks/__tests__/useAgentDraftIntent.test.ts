import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAgentDraftIntent } from '../useAgentDraftIntent';

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi
    .fn()
    .mockResolvedValue({ ok, status, json: async () => body }) as unknown as typeof fetch;
}

const draftResponse = {
  status: 'draft' as const,
  requiresConfirmation: true as const,
  summary: 'Drafted payment intent',
  intent: { type: 'payment' as const, destination: 'GDEST', amount: '10', asset: 'XLM' },
  risk: { level: 'low' as const, reasons: [] },
  source: 'deterministic' as const,
};

describe('useAgentDraftIntent', () => {
  it('starts idle', () => {
    const { result } = renderHook(() =>
      useAgentDraftIntent({ accountId: 'GACC', fetcher: fakeFetch(draftResponse) })
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.draft).toBeNull();
  });

  it('transitions to ready with the draft on success', async () => {
    const fetcher = fakeFetch(draftResponse);
    const { result } = renderHook(() => useAgentDraftIntent({ accountId: 'GACC', fetcher }));

    await act(async () => {
      await result.current.submitPrompt('Send 10 XLM to Alice');
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.draft).toEqual(draftResponse);
    expect(result.current.error).toBeNull();
  });

  it('does not call the network for an empty prompt', async () => {
    const fetcher = fakeFetch(draftResponse);
    const { result } = renderHook(() => useAgentDraftIntent({ accountId: 'GACC', fetcher }));

    await act(async () => {
      await result.current.submitPrompt('   ');
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.draft).toBeNull();
  });

  it('transitions to error state when the request fails', async () => {
    const fetcher = fakeFetch({ error: 'boom' }, false, 500);
    const { result } = renderHook(() => useAgentDraftIntent({ accountId: 'GACC', fetcher }));

    await act(async () => {
      await result.current.submitPrompt('Send 10 XLM to Alice');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('boom');
    expect(result.current.draft).toBeNull();
  });

  it('confirm() returns the draft without making any further network call', async () => {
    const fetcher = fakeFetch(draftResponse);
    const { result } = renderHook(() => useAgentDraftIntent({ accountId: 'GACC', fetcher }));

    await act(async () => {
      await result.current.submitPrompt('Send 10 XLM to Alice');
    });

    let confirmed;
    act(() => {
      confirmed = result.current.confirm();
    });

    expect(confirmed).toEqual(draftResponse);
    // Only the original draft-intent POST — confirm() never calls fetch itself.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reject() clears the draft and returns to idle', async () => {
    const fetcher = fakeFetch(draftResponse);
    const { result } = renderHook(() => useAgentDraftIntent({ accountId: 'GACC', fetcher }));

    await act(async () => {
      await result.current.submitPrompt('Send 10 XLM to Alice');
    });
    expect(result.current.draft).not.toBeNull();

    act(() => {
      result.current.reject();
    });

    expect(result.current.draft).toBeNull();
    expect(result.current.status).toBe('idle');
  });
});
