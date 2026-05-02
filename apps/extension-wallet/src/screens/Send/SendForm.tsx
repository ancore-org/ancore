import React from 'react';
import type { SendDraft } from '@/hooks/useSendDraft';

interface SendFormProps {
  draft: SendDraft;
  onChange: (patch: Partial<SendDraft>) => void;
  onSubmit: () => void;
  error?: string | null;
}

/**
 * SendForm — controlled form that is pre-populated from `draft`.
 *
 * When `error` is provided it is displayed inline beneath the inputs,
 * satisfying the "Errors are shown inline" acceptance criterion.
 */
export function SendForm({ draft, onChange, onSubmit, error }: SendFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 p-4"
      data-testid="send-form"
      aria-label="Send transaction form"
    >
      {/* Inline error banner — shown after a failed attempt */}
      {error && (
        <div
          role="alert"
          data-testid="send-form-error"
          className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mt-0.5 h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <span className="font-medium leading-relaxed">{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="send-recipient"
          className="text-[11px] uppercase tracking-widest text-slate-500 font-bold"
        >
          Recipient Address
        </label>
        <input
          id="send-recipient"
          data-testid="send-recipient"
          placeholder="G..."
          value={draft.recipient}
          onChange={(e) => onChange({ recipient: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="send-amount"
          className="text-[11px] uppercase tracking-widest text-slate-500 font-bold"
        >
          Amount XLM
        </label>
        <div className="relative">
          <input
            id="send-amount"
            data-testid="send-amount"
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600 [appearance:textfield]"
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 font-bold text-xs uppercase tracking-widest px-2 py-1 rounded bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors"
          >
            MAX
          </button>
        </div>
      </div>

      <button
        type="submit"
        data-testid="send-review-btn"
        className="w-full rounded-3xl bg-cyan-400 py-5 mt-6 text-sm font-black text-slate-950 shadow-[0_15px_30px_rgba(34,211,238,0.15)] uppercase tracking-widest transition hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!draft.recipient || !draft.amount}
      >
        Review Details
      </button>
    </form>
  );
}
