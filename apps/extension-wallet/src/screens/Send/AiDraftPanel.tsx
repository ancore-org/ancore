import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from '@ancore/ui-kit';
import { Sparkles, AlertTriangle, X } from 'lucide-react';
import { useAgentDraftIntent } from '@/hooks/useAgentDraftIntent';
import type { AgentDraftIntent, AgentRiskLevel } from '@/services/ai-agent-client';

interface AiDraftPanelProps {
  accountId: string;
  /** Called only when the user explicitly confirms the draft. Never called automatically. */
  onAccept: (intent: AgentDraftIntent) => void;
  onClose?: () => void;
  endpoint?: string;
  fetcher?: typeof fetch;
}

const RISK_STYLES: Record<AgentRiskLevel, string> = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  medium: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  high: 'text-red-300 bg-red-500/10 border-red-500/20',
};

function intentAmountLabel(intent: AgentDraftIntent): string {
  return `${intent.amount} ${intent.asset}`;
}

function intentTargetLabel(intent: AgentDraftIntent): string {
  return intent.type === 'payment' ? intent.destination : intent.recipient;
}

function intentTargetField(intent: AgentDraftIntent): string {
  return intent.type === 'payment' ? 'Destination' : 'Recipient';
}

/**
 * AiDraftPanel — natural-language "draft with AI" entry point for Send.
 *
 * Flow: type a request → call /agent/draft-intent → show the draft (type,
 * amount, asset, destination/recipient, risk, summary) → the user explicitly
 * confirms or rejects. Confirming only hands the drafted intent back to the
 * parent (`onAccept`) so it can prefill the normal send form — this
 * component never signs or submits a transaction itself.
 */
export function AiDraftPanel({
  accountId,
  onAccept,
  onClose,
  endpoint,
  fetcher,
}: AiDraftPanelProps) {
  const [prompt, setPrompt] = useState('');
  const { status, draft, error, submitPrompt, confirm, reject } = useAgentDraftIntent({
    accountId,
    endpoint,
    fetcher,
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitPrompt(prompt);
  };

  const handleConfirm = () => {
    const accepted = confirm();
    if (accepted) {
      onAccept(accepted.intent);
    }
  };

  const handleReject = () => {
    reject();
    setPrompt('');
  };

  return (
    <Card className="wallet-card border-white/10 bg-white/[0.03]" data-testid="ai-draft-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-teal-300" aria-hidden />
          Draft with AI
        </CardTitle>
        {onClose && (
          <button
            type="button"
            aria-label="Close AI draft"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Describe what you want to do — e.g. &quot;Send 10 XLM to Alice&quot; or &quot;Invoice Bob
          for 25 USDC&quot;. Nothing is sent until you review and confirm.
        </p>

        {!draft && (
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Send 10 XLM to Alice"
              rows={2}
              maxLength={2000}
              aria-label="Describe what you want to do"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-teal-400/50 focus:outline-none"
            />
            {error && (
              <p className="flex items-center gap-1.5 text-[12px] text-red-400" role="alert">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={status === 'loading' || prompt.trim().length === 0}
              className={cn('w-full')}
            >
              {status === 'loading' ? 'Drafting…' : 'Draft intent'}
            </Button>
          </form>
        )}

        {draft && (
          <div className="space-y-3" data-testid="ai-draft-result">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize text-foreground">{draft.intent.type}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium text-foreground">
                  {intentAmountLabel(draft.intent)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">
                  {intentTargetField(draft.intent)}
                </span>
                <span
                  className="truncate font-medium text-foreground"
                  title={intentTargetLabel(draft.intent)}
                >
                  {intentTargetLabel(draft.intent)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Risk</span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase',
                    RISK_STYLES[draft.risk.level]
                  )}
                  data-testid="ai-draft-risk-badge"
                >
                  {draft.risk.level}
                </span>
              </div>
              {draft.risk.reasons.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-amber-200/80">
                  {draft.risk.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[12px] text-muted-foreground">{draft.summary}</p>
            </div>

            <p className="text-[11px] text-muted-foreground">
              This is a draft only — nothing has been sent. Confirm to review it in the normal send
              flow, or reject to start over.
            </p>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleReject}>
                Reject
              </Button>
              <Button type="button" className="flex-1" onClick={handleConfirm}>
                Confirm draft
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
