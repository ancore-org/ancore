import Anthropic from '@anthropic-ai/sdk';
import { intentSchema } from '../schemas/intent';
import type { DraftIntentInput, LlmProvider, ProviderDraftResult } from './types';

/** Claude Haiku — fast, low-cost, sufficient for structured intent extraction. */
const MODEL = 'claude-haiku-4-5';

/** Hard ceiling on how long we wait for the LLM before falling back. */
const REQUEST_TIMEOUT_MS = 8_000;

const MAX_TOKENS = 512;

const TOOL_NAME = 'draft_intent';

/**
 * Tool schema mirrors docs/ai/intents.md exactly:
 *  - payment: type, amount, asset, destination
 *  - invoice: type, amount, asset, recipient, dueDate
 * `summary` is additionally requested for the human-readable draft summary.
 * Forced tool_choice guarantees the model's entire response is this shape —
 * final validation still happens against the Zod schemas in ../schemas/intent
 * before anything is trusted (see draftIntent() below).
 */
const DRAFT_INTENT_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Record a structured draft of the financial intent described in the prompt. ' +
    'This never executes anything — it only produces a draft for human confirmation.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['payment', 'invoice'],
        description:
          '"payment" to send funds to a destination; "invoice" to request funds from someone.',
      },
      amount: {
        type: 'string',
        description: 'Numeric amount as a string, e.g. "10" or "10.5". No currency symbols.',
      },
      asset: {
        type: 'string',
        enum: ['XLM', 'USDC'],
        description: 'Asset code. Default to XLM if the prompt does not specify a currency.',
      },
      destination: {
        type: 'string',
        description: 'Required when type is "payment": the receiving address or identifier.',
      },
      recipient: {
        type: 'string',
        description:
          'Required when type is "invoice": the identifier of the person/entity being billed.',
      },
      dueDate: {
        type: 'string',
        description:
          'Required when type is "invoice": ISO 8601 due date. Default to 7 days from now if unspecified.',
      },
      summary: {
        type: 'string',
        description: 'One short sentence summarizing the draft for display to the user.',
      },
    },
    required: ['type', 'amount', 'asset', 'summary'],
  },
};

function buildSystemPrompt(accountId: string): string {
  return [
    'You draft structured Stellar payment and invoice intents from natural-language requests.',
    `The requesting account is "${accountId}".`,
    'You NEVER execute, submit, or sign any transaction — you only produce a draft that a human will review and explicitly confirm.',
    'Always call the draft_intent tool exactly once with your best-effort structured extraction.',
    'If the prompt is ambiguous, make a reasonable assumption (default asset XLM) rather than refusing.',
  ].join(' ');
}

export class LlmOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputValidationError';
  }
}

/**
 * Claude Haiku implementation of LlmProvider, gated on ANTHROPIC_API_KEY.
 *
 * Never throws an un-typed error to the caller for "expected" failure modes
 * (missing key, timeout, malformed output) — every failure path throws so the
 * orchestrator (see ../draft-intent.ts) can fall back to the deterministic
 * parser, per issue #1005 item 3.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  private client: Anthropic | null;

  /**
   * @param client Optional pre-built client — used by tests to inject a mock
   *   in place of the real `@anthropic-ai/sdk` client (no real API calls).
   *   Production code should omit this; the client is lazily constructed
   *   from ANTHROPIC_API_KEY on first use.
   */
  constructor(client?: Anthropic) {
    this.client = client ?? null;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
    }
    return this.client;
  }

  isAvailable(): boolean {
    return this.client !== null || Boolean(process.env['ANTHROPIC_API_KEY']?.trim());
  }

  async draftIntent(input: DraftIntentInput): Promise<ProviderDraftResult> {
    if (!this.isAvailable()) {
      throw new Error('AnthropicProvider unavailable: ANTHROPIC_API_KEY is not set');
    }

    const client = this.getClient();

    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(input.accountId),
        tools: [DRAFT_INTENT_TOOL],
        tool_choice: { type: 'tool', name: TOOL_NAME },
        messages: [{ role: 'user', content: input.prompt }],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUse) {
      throw new LlmOutputValidationError('Anthropic response did not include a tool_use block');
    }

    return parseToolOutput(toolUse.input);
  }
}

/**
 * Validates raw tool input against the same Zod schemas used for
 * /v1/intents/validate. Invalid output throws — never trusted, never returned.
 */
function parseToolOutput(rawInput: unknown): ProviderDraftResult {
  if (typeof rawInput !== 'object' || rawInput === null) {
    throw new LlmOutputValidationError('Anthropic tool input was not an object');
  }

  const input = rawInput as Record<string, unknown>;
  const summary =
    typeof input['summary'] === 'string' && input['summary'].trim() ? input['summary'] : undefined;

  const candidate =
    input['type'] === 'invoice'
      ? {
          type: 'invoice' as const,
          amount: input['amount'],
          asset: input['asset'],
          recipient: input['recipient'],
          dueDate: input['dueDate'],
        }
      : {
          type: 'payment' as const,
          amount: input['amount'],
          asset: input['asset'],
          destination: input['destination'],
        };

  const parsed = intentSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new LlmOutputValidationError(
      `Anthropic tool output failed schema validation: ${parsed.error.message}`
    );
  }

  return {
    intent: parsed.data,
    summary:
      summary ??
      (parsed.data.type === 'invoice' ? 'Drafted invoice intent' : 'Drafted payment intent'),
  };
}
