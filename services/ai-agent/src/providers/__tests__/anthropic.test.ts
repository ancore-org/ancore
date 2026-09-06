import type Anthropic from '@anthropic-ai/sdk';
import { AnthropicProvider, LlmOutputValidationError } from '../anthropic';
import {
  OTHER_VALID_ADDRESS,
  VALID_ACCOUNT_ID,
  VALID_ADDRESS,
} from '../../__tests__/fixtures/addresses';

/** Builds a fake Anthropic client — no real SDK instance, no network calls. */
function fakeClient(create: jest.Mock): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

function toolUseResponse(input: Record<string, unknown>) {
  return {
    content: [{ type: 'tool_use', id: 'tu_1', name: 'draft_intent', input }],
  };
}

describe('AnthropicProvider', () => {
  const originalKey = process.env['ANTHROPIC_API_KEY'];

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env['ANTHROPIC_API_KEY'];
    } else {
      process.env['ANTHROPIC_API_KEY'] = originalKey;
    }
  });

  describe('isAvailable', () => {
    it('is unavailable when ANTHROPIC_API_KEY is unset and no client was injected', () => {
      delete process.env['ANTHROPIC_API_KEY'];
      const provider = new AnthropicProvider();
      expect(provider.isAvailable()).toBe(false);
    });

    it('is available when ANTHROPIC_API_KEY is set', () => {
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';
      const provider = new AnthropicProvider();
      expect(provider.isAvailable()).toBe(true);
    });

    it('is available when a client is injected regardless of env var', () => {
      delete process.env['ANTHROPIC_API_KEY'];
      const provider = new AnthropicProvider(fakeClient(jest.fn()));
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('draftIntent — successful structured parse', () => {
    it('returns a validated payment intent from the tool_use block', async () => {
      const create = jest.fn().mockResolvedValue(
        toolUseResponse({
          type: 'payment',
          amount: '42',
          asset: 'USDC',
          destination: VALID_ADDRESS,
          summary: 'Send 42 USDC',
        })
      );
      const provider = new AnthropicProvider(fakeClient(create));

      const result = await provider.draftIntent({
        prompt: 'send 42 usdc',
        accountId: VALID_ACCOUNT_ID,
      });

      expect(create).toHaveBeenCalledTimes(1);
      const [params, options] = create.mock.calls[0];
      expect(params.model).toBe('claude-haiku-4-5');
      expect(params.tool_choice).toEqual({ type: 'tool', name: 'draft_intent' });
      expect(options).toMatchObject({ timeout: expect.any(Number) });

      expect(result.intent).toEqual({
        type: 'payment',
        amount: '42',
        asset: 'USDC',
        destination: VALID_ADDRESS,
      });
      expect(result.summary).toBe('Send 42 USDC');
    });

    it('returns a validated invoice intent from the tool_use block', async () => {
      const create = jest.fn().mockResolvedValue(
        toolUseResponse({
          type: 'invoice',
          amount: '15',
          asset: 'XLM',
          recipient: OTHER_VALID_ADDRESS,
          dueDate: '2026-12-31T00:00:00Z',
          summary: 'Invoice Alice for 15 XLM',
        })
      );
      const provider = new AnthropicProvider(fakeClient(create));

      const result = await provider.draftIntent({
        prompt: 'invoice Alice for 15 XLM',
        accountId: VALID_ACCOUNT_ID,
      });

      expect(result.intent).toEqual({
        type: 'invoice',
        amount: '15',
        asset: 'XLM',
        recipient: OTHER_VALID_ADDRESS,
        dueDate: '2026-12-31T00:00:00Z',
      });
    });
  });

  describe('draftIntent — malformed output falls back', () => {
    it('throws LlmOutputValidationError when amount fails the numeric-string regex', async () => {
      const create = jest.fn().mockResolvedValue(
        toolUseResponse({
          type: 'payment',
          amount: 'a lot',
          asset: 'XLM',
          destination: VALID_ADDRESS,
          summary: 'bad',
        })
      );
      const provider = new AnthropicProvider(fakeClient(create));

      await expect(
        provider.draftIntent({ prompt: 'send a lot of xlm', accountId: VALID_ACCOUNT_ID })
      ).rejects.toThrow(LlmOutputValidationError);
    });

    it('throws when the response has no tool_use block', async () => {
      const create = jest
        .fn()
        .mockResolvedValue({ content: [{ type: 'text', text: 'no tool call' }] });
      const provider = new AnthropicProvider(fakeClient(create));

      await expect(
        provider.draftIntent({ prompt: 'hello', accountId: VALID_ACCOUNT_ID })
      ).rejects.toThrow(LlmOutputValidationError);
    });

    it('throws when required fields are missing for the intent type', async () => {
      const create = jest
        .fn()
        .mockResolvedValue(
          toolUseResponse({ type: 'payment', amount: '10', asset: 'XLM', summary: 'missing dest' })
        );
      const provider = new AnthropicProvider(fakeClient(create));

      await expect(
        provider.draftIntent({ prompt: 'send xlm', accountId: VALID_ACCOUNT_ID })
      ).rejects.toThrow(LlmOutputValidationError);
    });
  });

  describe('draftIntent — timeout / error falls back', () => {
    it('propagates network/timeout errors from the SDK client', async () => {
      const create = jest.fn().mockRejectedValue(new Error('timeout of 8000ms exceeded'));
      const provider = new AnthropicProvider(fakeClient(create));

      await expect(
        provider.draftIntent({ prompt: 'send xlm', accountId: VALID_ACCOUNT_ID })
      ).rejects.toThrow('timeout of 8000ms exceeded');
    });

    it('throws when the provider is unavailable', async () => {
      delete process.env['ANTHROPIC_API_KEY'];
      const provider = new AnthropicProvider();

      await expect(
        provider.draftIntent({ prompt: 'send xlm', accountId: VALID_ACCOUNT_ID })
      ).rejects.toThrow(/unavailable/i);
    });
  });
});
