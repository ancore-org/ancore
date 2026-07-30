import { generateDraftIntent } from '../draft-intent';
import type { DraftIntentInput, LlmProvider, ProviderDraftResult } from '../providers/types';

function stubProvider(overrides: Partial<LlmProvider>): LlmProvider {
  return {
    name: 'stub',
    isAvailable: () => true,
    draftIntent: async () => {
      throw new Error('not implemented');
    },
    ...overrides,
  };
}

describe('generateDraftIntent', () => {
  const input: DraftIntentInput = { prompt: 'Send 10 XLM to Alice', accountId: 'GACC' };

  it('uses the LLM provider and reports source "llm" when it succeeds', async () => {
    const llmResult: ProviderDraftResult = {
      intent: { type: 'payment', amount: '10', asset: 'XLM', destination: 'GDEST' },
      summary: 'from llm',
    };
    const provider = stubProvider({
      isAvailable: () => true,
      draftIntent: async () => llmResult,
    });

    const result = await generateDraftIntent(input, provider);

    expect(result.source).toBe('llm');
    expect(result.intent).toEqual(llmResult.intent);
    expect(result.summary).toBe('from llm');
  });

  it('falls back to the deterministic parser and reports source "deterministic" when the provider throws', async () => {
    const provider = stubProvider({
      isAvailable: () => true,
      draftIntent: async () => {
        throw new Error('LLM exploded');
      },
    });

    const result = await generateDraftIntent(input, provider);

    expect(result.source).toBe('deterministic');
    expect(result.intent.type).toBe('payment');
  });

  it('falls back to the deterministic parser without calling the provider when unavailable', async () => {
    const draftIntent = jest.fn();
    const provider = stubProvider({ isAvailable: () => false, draftIntent });

    const result = await generateDraftIntent(input, provider);

    expect(draftIntent).not.toHaveBeenCalled();
    expect(result.source).toBe('deterministic');
  });

  it('falls back to the deterministic parser when the provider times out', async () => {
    const provider = stubProvider({
      isAvailable: () => true,
      draftIntent: async () => {
        throw new Error('timeout of 8000ms exceeded');
      },
    });

    const result = await generateDraftIntent(input, provider);

    expect(result.source).toBe('deterministic');
  });
});
