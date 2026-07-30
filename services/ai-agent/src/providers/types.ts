import type { Intent } from '../schemas/intent';

/** Where a drafted intent came from — surfaced in the API response and audit logs. */
export type DraftSource = 'llm' | 'deterministic';

export interface DraftIntentInput {
  /** Natural-language description of the intended operation */
  prompt: string;
  /** Stellar account address of the initiating user */
  accountId: string;
  /** Optional context for the intent (e.g. invoice ID, session key) */
  context?: Record<string, unknown>;
}

export interface ProviderDraftResult {
  /** Structured intent — MUST validate against the Zod schemas in ../schemas/intent */
  intent: Intent;
  /** Human-readable summary for display */
  summary: string;
}

/**
 * Provider interface for turning a natural-language prompt into a structured,
 * schema-conformant draft intent.
 *
 * Implementations MUST NOT execute any financial operation — they only produce
 * a draft. See ../guardrail.ts for the enforcement of that invariant.
 */
export interface LlmProvider {
  /** Provider identifier, used in logs (e.g. "anthropic") */
  readonly name: string;
  /** Whether this provider is configured and usable (e.g. API key present) */
  isAvailable(): boolean;
  /**
   * Produce a structured draft intent from a natural-language prompt.
   * @throws if the provider is unavailable, times out, errors, or produces
   *   output that fails schema validation — callers should fall back to the
   *   deterministic parser on any rejection.
   */
  draftIntent(input: DraftIntentInput): Promise<ProviderDraftResult>;
}
