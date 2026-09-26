import type Anthropic from '@anthropic-ai/sdk';
import type { HandleResolver } from '@ancore/types';
import { AnthropicProvider } from '../providers/anthropic';
import { deterministicDraftIntent } from '../providers/deterministic';
import { generateDraftIntent } from '../draft-intent';
import { RecipientResolutionError } from '../recipients';
import { log } from '../logging/logger';
import type { LlmProvider } from '../providers/types';
import {
  CHECKSUM_INVALID_ADDRESS,
  NON_BASE32_ADDRESS,
  RESOLVED_ADDRESS,
  UNRESOLVABLE_HANDLE,
  VALID_ACCOUNT_ID,
  VALID_ADDRESS,
  VALID_HANDLE,
} from './fixtures/addresses';

/**
 * Issue #1210 — destination/recipient validation, exercised through BOTH
 * draft paths.
 *
 * Each scenario runs twice: once with the Anthropic provider (a fake client
 * returns the tool output, so no network call), and once with the
 * deterministic parser (provider unavailable, value carried in the prompt).
 * Both funnel through `generateDraftIntent`, which is where handle resolution
 * runs — so these cover the schema layer and the resolution layer together,
 * exactly as production does.
 */

/** Fake Anthropic client — no real SDK instance, no network calls. */
function fakeClient(input: Record<string, unknown>): Anthropic {
  return {
    messages: {
      create: jest
        .fn()
        .mockResolvedValue({ content: [{ type: 'tool_use', id: 'tu_1', name: 'x', input }] }),
    },
  } as unknown as Anthropic;
}

/** Provider that is never available, forcing the deterministic fallback. */
const unavailableProvider: LlmProvider = {
  name: 'stub',
  isAvailable: () => false,
  draftIntent: async () => {
    throw new Error('never called');
  },
};

/** Resolver that knows exactly one handle. */
const resolver: HandleResolver = async (handle) =>
  handle === VALID_HANDLE ? { handle, accountAddress: RESOLVED_ADDRESS } : null;

/** Draft via the LLM path, with `destination` coming straight from the model. */
function draftViaAnthropic(destination: unknown) {
  const provider = new AnthropicProvider(
    fakeClient({ type: 'payment', amount: '10', asset: 'XLM', destination, summary: 's' })
  );
  return generateDraftIntent(
    { prompt: 'send 10 xlm', accountId: VALID_ACCOUNT_ID },
    provider,
    resolver
  );
}

/** Draft via the deterministic path, with the value embedded in the prompt. */
function draftViaDeterministic(destination: string) {
  return generateDraftIntent(
    { prompt: `Send 10 XLM to ${destination}`, accountId: VALID_ACCOUNT_ID },
    unavailableProvider,
    resolver
  );
}

describe('recipient validation across both provider paths (#1210)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    // generateDraftIntent logs at error level when the LLM path is rejected and
    // it falls back; that is expected here and would otherwise spam the output.
    errorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
  });

  afterEach(() => errorSpy.mockRestore());

  describe.each([
    ['anthropic', draftViaAnthropic] as const,
    ['deterministic', draftViaDeterministic] as const,
  ])('%s provider', (name, draft) => {
    // 1. Valid G-address → accepted and passed through unchanged.
    it('accepts a checksum-valid G-address and leaves it unnormalised', async () => {
      const result = await draft(VALID_ADDRESS);

      expect(result.source).toBe(name === 'anthropic' ? 'llm' : 'deterministic');
      expect(result.intent.type).toBe('payment');
      if (result.intent.type === 'payment') {
        expect(result.intent.destination).toBe(VALID_ADDRESS);
        // No handle was involved, so there is nothing to record provenance for.
        expect(result.intent.resolvedFrom).toBeUndefined();
      }
    });

    // 2. Valid resolvable handle → accepted, REPLACED by the resolved address.
    it('accepts a resolvable @handle and replaces it with the resolved address', async () => {
      const result = await draft(VALID_HANDLE);

      expect(result.intent.type).toBe('payment');
      if (result.intent.type === 'payment') {
        // Gate 0 decision 4b: downstream consumers only ever see an address...
        expect(result.intent.destination).toBe(RESOLVED_ADDRESS);
        // ...with the original handle preserved for display.
        expect(result.intent.resolvedFrom).toBe(VALID_HANDLE);
      }
    });

    // 3. Malformed address (right shape, wrong CRC16) → rejected.
    it('rejects a checksum-invalid address that a format regex would accept', async () => {
      await expect(draft(CHECKSUM_INVALID_ADDRESS)).rejects.toThrow(/destination/i);
    });

    // 4. Genuinely malformed non-empty garbage → rejected by the new layer,
    //    not merely by the old `.min(1)` emptiness check.
    it.each([
      ['a bare display name', 'Bob'],
      ['a non-base32 lookalike', NON_BASE32_ADDRESS],
    ])('rejects %s', async (_label, value) => {
      await expect(draft(value)).rejects.toThrow(/destination/i);
    });

    // 5. Well-formed handle syntax that resolves to nothing → rejected, and
    //    distinguishably so: a resolution failure, not a format failure.
    it('rejects an unresolvable @handle as a resolution failure, not a format failure', async () => {
      await expect(draft(UNRESOLVABLE_HANDLE)).rejects.toThrow(RecipientResolutionError);
      await expect(draft(UNRESOLVABLE_HANDLE)).rejects.toThrow(/handle not found/i);
    });
  });

  // The deterministic parser only ever sees strings from the prompt, so the
  // empty and non-string cases are reachable only on the LLM path.
  describe('anthropic provider — non-string and empty output', () => {
    it.each([
      ['an empty string', ''],
      ['whitespace only', '   '],
      ['a missing field', undefined],
      ['a non-string value', 42],
    ])('rejects %s', async (_label, value) => {
      await expect(draftViaAnthropic(value)).rejects.toThrow(/destination/i);
    });
  });

  describe('deterministic provider — invoice path', () => {
    // Confirms Gate 0 item 2: `recipient: accountId` is closed transitively by
    // running the constructed intent through intentSchema, rather than by
    // validating accountId at the request layer (out of scope for #1210).
    it('rejects a malformed accountId reaching `recipient` via the invoice path', () => {
      expect(() =>
        deterministicDraftIntent({ prompt: 'invoice me for 5 XLM', accountId: 'GACC' })
      ).toThrow(/Recipient must be a Stellar address/);
    });

    it('accepts a valid accountId as the invoice recipient', () => {
      const result = deterministicDraftIntent({
        prompt: 'invoice me for 5 XLM',
        accountId: VALID_ACCOUNT_ID,
      });

      expect(result.intent.type).toBe('invoice');
      if (result.intent.type === 'invoice') {
        expect(result.intent.recipient).toBe(VALID_ACCOUNT_ID);
      }
    });
  });

  describe('resolution ordering', () => {
    it('never returns a draft whose recipient is still an unresolved handle', async () => {
      const result = await draftViaAnthropic(VALID_HANDLE);

      if (result.intent.type === 'payment') {
        expect(result.intent.destination.startsWith('@')).toBe(false);
      }
    });

    it('rejects a handle when no resolver is configured rather than passing it through', async () => {
      const provider = new AnthropicProvider(
        fakeClient({
          type: 'payment',
          amount: '10',
          asset: 'XLM',
          destination: VALID_HANDLE,
          summary: 's',
        })
      );

      await expect(
        generateDraftIntent({ prompt: 'send 10 xlm', accountId: VALID_ACCOUNT_ID }, provider, null)
      ).rejects.toThrow(/no handle resolver is configured/);
    });
  });
});
