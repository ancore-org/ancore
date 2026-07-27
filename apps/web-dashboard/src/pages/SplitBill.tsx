import type { FC, ReactNode, FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Users, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { useSplitBill } from '../hooks/useSplitBill';
import type { SplitBill, SplitBillStatus } from '../types/split-bill';
import {
  validateShares,
  errorsByKey,
  formError,
  formatAmount,
  parseDecimal,
  type SplitMode,
} from '../lib/split-bill-validation';

// ── Create form ───────────────────────────────────────────────────────────────

interface ParticipantDraft {
  key: string;
  address: string;
  alias: string;
  /** Amount owed, or percentage share — depending on the selected split mode. */
  amount: string;
  assetCode: string;
}

function newParticipant(): ParticipantDraft {
  return { key: crypto.randomUUID(), address: '', alias: '', amount: '', assetCode: 'XLM' };
}

/** Live summary of what the entered shares currently add up to. */
function ShareSummary({
  mode,
  sum,
  total,
}: {
  mode: SplitMode;
  sum: number;
  total: number | null;
}) {
  const target = mode === 'percentage' ? 100 : total;
  if (target === null) return null;

  const balanced = Math.abs(sum - target) < 0.5e-7;
  const suffix = mode === 'percentage' ? '%' : '';

  return (
    <p
      className={`text-xs mt-2 ${balanced ? 'text-green-600' : 'text-amber-600'}`}
      data-testid="share-summary"
    >
      {formatAmount(sum)}
      {suffix} of {formatAmount(target)}
      {suffix} allocated
    </p>
  );
}

function CreateBillForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { createBill } = useSplitBill();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [creatorAddress, setCreatorAddress] = useState('');
  const [mode, setMode] = useState<SplitMode>('amount');
  const [totalAmount, setTotalAmount] = useState('');
  const [participants, setParticipants] = useState<ParticipantDraft[]>([newParticipant()]);
  const [error, setError] = useState('');
  const [shareErrors, setShareErrors] = useState<Record<string, string>>({});

  // Recomputed on every render so the running total updates as the user types.
  // Errors are only *surfaced* on submit; this just drives the live summary.
  const preview = validateShares({
    mode,
    participants: participants.map((p) => ({ key: p.key, share: p.amount })),
    totalAmount,
  });
  const parsedTotal = parseDecimal(totalAmount);

  function updateParticipant(key: string, patch: Partial<ParticipantDraft>) {
    setParticipants((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function removeParticipant(key: string) {
    setParticipants((prev) => prev.filter((p) => p.key !== key));
  }

  function handleModeChange(next: SplitMode) {
    setMode(next);
    setError('');
    setShareErrors({});
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setShareErrors({});

    if (!title.trim()) return setError('Title is required.');
    if (!creatorAddress.trim()) return setError('Your address is required.');
    if (participants.length === 0) return setError('Add at least one participant.');

    for (const p of participants) {
      if (!p.address.trim()) return setError('All participants need an address.');
    }

    // Shares must add up: to 100% in percentage mode, or to the bill total in
    // amount mode when one was given.
    const result = validateShares({
      mode,
      participants: participants.map((p) => ({ key: p.key, share: p.amount })),
      totalAmount,
    });

    if (!result.valid) {
      setShareErrors(errorsByKey(result.errors));
      setError(formError(result.errors) ?? 'Fix the highlighted participant shares.');
      return;
    }

    const bill = createBill({
      title,
      note,
      creatorAddress,
      participants: participants.map((p) => ({
        address: p.address.trim(),
        alias: p.alias.trim() || undefined,
        // In percentage mode the stored amount is the share converted against
        // the bill total, so a bill always persists concrete amounts.
        amount: result.amounts[p.key],
        assetCode: p.assetCode,
      })),
    });

    onCreated(bill.id);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <h3 className="text-lg font-semibold">Create split bill</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Title *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dinner at Nobu"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Your address *</span>
          <input
            value={creatorAddress}
            onChange={(e) => setCreatorAddress(e.target.value)}
            placeholder="G..."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional description"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>

      {/* Split mode + bill total */}
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Split by</legend>
          <div className="mt-1 inline-flex rounded-lg border border-slate-300 p-0.5">
            {(['amount', 'percentage'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleModeChange(option)}
                aria-pressed={mode === option}
                className={`rounded-md px-3 py-1.5 text-xs capitalize transition-colors ${
                  mode === option
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Bill total {mode === 'percentage' ? '*' : '(optional)'}
          </span>
          <input
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="100"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <span className="mt-1 block text-xs text-slate-500">
            {mode === 'percentage'
              ? 'Percentage shares are converted against this total.'
              : 'When set, participant amounts must add up to it.'}
          </span>
        </label>
      </div>

      {/* Participants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Participants *</span>
          <button
            type="button"
            onClick={() => setParticipants((prev) => [...prev, newParticipant()])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <Plus className="w-3 h-3" /> Add participant
          </button>
        </div>

        <ul className="space-y-3">
          {participants.map((p) => {
            const shareError = shareErrors[p.key];
            const shareErrorId = `share-error-${p.key}`;

            return (
              <li key={p.key}>
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end">
                  <label className="block">
                    <span className="text-xs text-slate-500">Address *</span>
                    <input
                      value={p.address}
                      onChange={(e) => updateParticipant(p.key, { address: e.target.value })}
                      placeholder="G..."
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Alias</span>
                    <input
                      value={p.alias}
                      onChange={(e) => updateParticipant(p.key, { alias: e.target.value })}
                      placeholder="Alice"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">
                      {mode === 'percentage' ? 'Share % *' : 'Amount *'}
                    </span>
                    <input
                      value={p.amount}
                      onChange={(e) => updateParticipant(p.key, { amount: e.target.value })}
                      placeholder={mode === 'percentage' ? '50' : '10'}
                      type="number"
                      min="0"
                      step="any"
                      aria-invalid={shareError ? true : undefined}
                      aria-describedby={shareError ? shareErrorId : undefined}
                      className={`mt-1 w-24 rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 ${
                        shareError
                          ? 'border-red-400 focus:ring-red-400'
                          : 'border-slate-300 focus:ring-slate-400'
                      }`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Asset</span>
                    <input
                      value={p.assetCode}
                      onChange={(e) => updateParticipant(p.key, { assetCode: e.target.value })}
                      placeholder="XLM"
                      className="mt-1 w-16 rounded border border-slate-300 px-2 py-1.5 text-xs uppercase focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.key)}
                    disabled={participants.length === 1}
                    className="mb-0.5 p-1.5 rounded text-slate-400 hover:text-red-500 disabled:opacity-30"
                    aria-label="Remove participant"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {shareError && (
                  <p id={shareErrorId} className="mt-1 text-xs text-red-600">
                    {shareError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <ShareSummary mode={mode} sum={preview.sum} total={parsedTotal} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
      >
        Create split bill
      </button>
    </form>
  );
}

// ── Bill list ─────────────────────────────────────────────────────────────────

const BILL_STATUS_CONFIG: Record<SplitBillStatus, { icon: ReactNode; className: string }> = {
  open: { icon: <Clock className="w-3.5 h-3.5" />, className: 'text-blue-600 bg-blue-50' },
  completed: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    className: 'text-green-600 bg-green-50',
  },
  expired: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    className: 'text-slate-500 bg-slate-100',
  },
  cancelled: { icon: <XCircle className="w-3.5 h-3.5" />, className: 'text-red-600 bg-red-50' },
};

function BillCard({ bill, onClick }: { bill: SplitBill; onClick: () => void }) {
  const cfg = BILL_STATUS_CONFIG[bill.status];
  const paidCount = bill.participants.filter((p) => p.status === 'paid').length;
  const total = bill.participants.length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-slate-200 p-4 hover:border-slate-400 hover:shadow-sm transition-all"
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{bill.title}</p>
          {bill.note && <p className="text-xs text-slate-500 mt-0.5 truncate">{bill.note}</p>}
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${cfg.className}`}
        >
          {cfg.icon}
          {bill.status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {total} participant{total !== 1 ? 's' : ''}
        </span>
        <span>
          {paidCount}/{total} paid
        </span>
        <span className="ml-auto">Expires {new Date(bill.expiresAt).toLocaleDateString()}</span>
      </div>

      {/* Mini progress bar */}
      <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
        <div
          className="bg-green-500 h-1.5 rounded-full"
          style={{ width: total > 0 ? `${(paidCount / total) * 100}%` : '0%' }}
        />
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const SplitBillPage: FC = () => {
  const navigate = useNavigate();
  const { bills, isLoading } = useSplitBill();
  const [showForm, setShowForm] = useState(false);

  function handleCreated(id: string) {
    setShowForm(false);
    navigate(`/split-bill/${id}`);
  }

  return (
    <section aria-label="Split bills">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Split Bills</h2>
          <p className="text-sm text-slate-500 mt-1">Create and track group payments</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm text-white hover:bg-slate-800"
          type="button"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Cancel' : 'New bill'}
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-slate-200 p-6">
          <CreateBillForm onCreated={handleCreated} />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : bills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No split bills yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-blue-600 hover:underline"
            type="button"
          >
            Create your first bill
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {[...bills].reverse().map((bill) => (
            <li key={bill.id}>
              <BillCard bill={bill} onClick={() => navigate(`/split-bill/${bill.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
