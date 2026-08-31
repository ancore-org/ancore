import { AnthropicProvider } from './providers/anthropic';
import { deterministicDraftIntent } from './providers/deterministic';
import type {
  DraftIntentInput,
  DraftSource,
  LlmProvider,
  ProviderDraftResult,
} from './providers/types';
import { intentSchema } from './schemas/intent';
import { log } from './logging/logger';

export interface DraftIntentResult extends ProviderDraftResult {
  source: DraftSource;
}

// Lazily-constructed singleton — the Anthropic client itself is only created
// inside AnthropicProvider on first use, so importing this module has no
// side effects when ANTHROPIC_API_KEY is unset (e.g. in tests).
const defaultProvider: LlmProvider = new AnthropicProvider();

/**
 * Produces a structured draft intent for a natural-language prompt.
 *
 * Tries the LLM provider first when it's configured (ANTHROPIC_API_KEY set).
 * Any failure — unavailable, network error, timeout, or output that fails
 * schema validation — falls back to the deterministic parser so the endpoint
 * always succeeds, per issue #1005 item 3. The returned `source` field lets
 * callers and audit logs distinguish which path produced the draft.
 *
 * The deterministic parser's output is validated against the same
 * intentSchema the LLM path enforces before it is ever returned, so a
 * malformed draft (e.g. a zero or out-of-range amount) throws here instead
 * of silently reaching the caller.
 */
export async function generateDraftIntent(
  input: DraftIntentInput,
  provider: LlmProvider = defaultProvider
): Promise<DraftIntentResult> {
  if (provider.isAvailable()) {
    try {
      const result = await provider.draftIntent(input);
      return { ...result, source: 'llm' };
    } catch (err) {
      log.error(
        {
          accountId: input.accountId,
          provider: provider.name,
          error: err instanceof Error ? err.message : String(err),
        },
        'llm_provider_failed_falling_back_to_deterministic'
      );
    }
  }

  const result = deterministicDraftIntent(input);
  const parsed = intentSchema.safeParse(result.intent);
  if (!parsed.success) {
    throw new Error(
      `Deterministic provider output failed schema validation: ${parsed.error.message}`
    );
  }

  return { ...result, intent: parsed.data, source: 'deterministic' };
}
