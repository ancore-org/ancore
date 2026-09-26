/**
 * Client for the ai-agent service's /agent/draft-intent endpoint (issue #1005).
 *
 * IMPORTANT: this client only ever *drafts* an intent — it never signs or
 * submits anything on-chain. The response is always a draft that requires
 * explicit user confirmation; see useAgentDraftIntent for the confirm/reject
 * flow that consumes it.
 */

export type AgentDraftIntentType = 'payment' | 'invoice';

export interface AgentDraftPaymentIntent {
  type: 'payment';
  destination: string;
  amount: string;
  asset: string;
}

export interface AgentDraftInvoiceIntent {
  type: 'invoice';
  recipient: string;
  amount: string;
  asset: string;
  dueDate: string;
}

export type AgentDraftIntent = AgentDraftPaymentIntent | AgentDraftInvoiceIntent;

export type AgentRiskLevel = 'low' | 'medium' | 'high';

export interface AgentRiskScore {
  level: AgentRiskLevel;
  reasons: string[];
}

export type AgentDraftSource = 'llm' | 'deterministic';

export interface AgentDraftIntentResponse {
  status: 'draft';
  requiresConfirmation: true;
  summary: string;
  intent: AgentDraftIntent;
  risk: AgentRiskScore;
  source?: AgentDraftSource;
}

export interface AiAgentClientOptions {
  endpoint?: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export class AiAgentRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'AiAgentRequestError';
  }
}

function resolveDefaultEndpoint(): string {
  const configured =
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_AI_AGENT_URL : undefined;
  return configured ?? 'http://localhost:3001';
}

function resolveDefaultApiKey(): string | undefined {
  return typeof import.meta !== 'undefined' ? import.meta.env?.VITE_AI_AGENT_API_KEY : undefined;
}

/**
 * Creates a client for the ai-agent service. `fetcher` is injectable for
 * tests; `endpoint` defaults to VITE_AI_AGENT_URL or localhost:3001;
 * `apiKey` defaults to VITE_AI_AGENT_API_KEY and is sent as the `x-api-key`
 * header the service requires on every request.
 */
export function createAiAgentClient({
  endpoint = resolveDefaultEndpoint(),
  apiKey = resolveDefaultApiKey(),
  fetcher = fetch,
}: AiAgentClientOptions = {}) {
  return {
    async draftIntent(params: {
      prompt: string;
      accountId: string;
      context?: Record<string, unknown>;
    }): Promise<AgentDraftIntentResponse> {
      const response = await fetcher(`${endpoint.replace(/\/$/, '')}/agent/draft-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        let message = `Draft request failed with HTTP ${response.status}`;
        try {
          const data = await response.json();
          if (data && typeof data.error === 'string') {
            message = data.error;
          }
        } catch {
          // response body wasn't JSON — keep the generic message
        }
        throw new AiAgentRequestError(message, response.status);
      }

      const data = (await response.json()) as AgentDraftIntentResponse;

      // Belt-and-suspenders client-side guardrail check: never trust a
      // response that isn't an explicit, confirmation-required draft.
      if (data.status !== 'draft' || data.requiresConfirmation !== true) {
        throw new AiAgentRequestError(
          'ai-agent service returned a non-draft response — refusing to display it'
        );
      }

      return data;
    },
  };
}

export const draftAiAgentIntent = createAiAgentClient().draftIntent;
