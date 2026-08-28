import { useCallback, useState } from 'react';
import {
  createAiAgentClient,
  type AgentDraftIntentResponse,
  type AiAgentClientOptions,
} from '@/services/ai-agent-client';

export type AgentDraftStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseAgentDraftIntentOptions extends AiAgentClientOptions {
  accountId: string;
}

/**
 * Drives the natural-language "draft with AI" flow: submit a prompt, receive
 * a draft intent, and require an explicit confirm or reject before anything
 * else happens.
 *
 * GUARDRAIL: this hook never submits a transaction. `confirm()` only marks
 * the draft accepted and returns it to the caller — the caller is
 * responsible for routing the accepted draft through the normal
 * review → confirm → sign flow. There is no code path here that reaches the
 * network beyond the draft-intent request itself.
 */
export function useAgentDraftIntent({ accountId, endpoint, fetcher }: UseAgentDraftIntentOptions) {
  const [status, setStatus] = useState<AgentDraftStatus>('idle');
  const [draft, setDraft] = useState<AgentDraftIntentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = createAiAgentClient({ endpoint, fetcher });

  const submitPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) {
        setError('Enter a description of what you want to do.');
        setStatus('error');
        return;
      }

      setStatus('loading');
      setError(null);
      setDraft(null);

      try {
        const result = await client.draftIntent({ prompt: trimmed, accountId });
        setDraft(result);
        setStatus('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to draft intent.');
        setStatus('error');
      }
    },
    [accountId, client]
  );

  /** Accepts the draft and hands it back to the caller. Never submits on-chain. */
  const confirm = useCallback((): AgentDraftIntentResponse | null => {
    return draft;
  }, [draft]);

  const reject = useCallback(() => {
    setDraft(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { status, draft, error, submitPrompt, confirm, reject };
}
