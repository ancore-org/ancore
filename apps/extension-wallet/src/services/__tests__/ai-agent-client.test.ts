import { describe, expect, it, vi } from 'vitest';
import { AiAgentRequestError, createAiAgentClient } from '../ai-agent-client';

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('createAiAgentClient', () => {
  it('posts to /agent/draft-intent and returns the parsed draft', async () => {
    const responseBody = {
      status: 'draft',
      requiresConfirmation: true,
      summary: 'Drafted payment intent',
      intent: { type: 'payment', destination: 'GDEST', amount: '10', asset: 'XLM' },
      risk: { level: 'low', reasons: [] },
      source: 'deterministic',
    };
    const fetcher = fakeFetch(responseBody);

    const client = createAiAgentClient({ endpoint: 'http://localhost:3001', fetcher });
    const result = await client.draftIntent({ prompt: 'Send 10 XLM to Alice', accountId: 'GACC' });

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/agent/draft-intent',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Send 10 XLM to Alice', accountId: 'GACC' }),
      })
    );
    expect(result).toEqual(responseBody);
  });

  it('strips a trailing slash from the endpoint', async () => {
    const fetcher = fakeFetch({
      status: 'draft',
      requiresConfirmation: true,
      summary: 's',
      intent: { type: 'payment', destination: 'G', amount: '1', asset: 'XLM' },
      risk: { level: 'low', reasons: [] },
    });
    const client = createAiAgentClient({ endpoint: 'http://localhost:3001/', fetcher });
    await client.draftIntent({ prompt: 'x', accountId: 'GACC' });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/agent/draft-intent',
      expect.anything()
    );
  });

  it('throws AiAgentRequestError with the server error message on non-ok response', async () => {
    const fetcher = fakeFetch({ error: 'Too many draft-intent requests.' }, false, 429);
    const client = createAiAgentClient({ endpoint: 'http://localhost:3001', fetcher });

    await expect(client.draftIntent({ prompt: 'x', accountId: 'GACC' })).rejects.toThrow(
      AiAgentRequestError
    );
    await expect(client.draftIntent({ prompt: 'x', accountId: 'GACC' })).rejects.toThrow(
      'Too many draft-intent requests.'
    );
  });

  it('rejects a response that is not an explicit confirmation-required draft', async () => {
    const fetcher = fakeFetch({
      status: 'executed',
      requiresConfirmation: false,
      summary: 's',
      intent: { type: 'payment', destination: 'G', amount: '1', asset: 'XLM' },
      risk: { level: 'low', reasons: [] },
    });
    const client = createAiAgentClient({ endpoint: 'http://localhost:3001', fetcher });

    await expect(client.draftIntent({ prompt: 'x', accountId: 'GACC' })).rejects.toThrow(
      /non-draft/i
    );
  });
});
