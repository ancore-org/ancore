import React from 'react';
import { ArrowDownLeft, Clock } from 'lucide-react';

export interface TransactionItem {
  id: string;
  kind?: 'sent' | 'received' | string;
  amount: string;
  label?: string;
  timestamp?: string;
  status?: string;
}

export interface HistoryListProps {
  items: TransactionItem[];
  isLoading?: boolean;
  onReceive?: () => void;
  onSelectItem?: (item: TransactionItem) => void;
}

export function HistoryList({
  items,
  isLoading = false,
  onReceive,
  onSelectItem,
}: HistoryListProps) {
  if (isLoading) {
    return (
      <div data-testid="history-loading" className="space-y-3 py-4">
        <div className="h-14 w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="h-14 w-full animate-pulse rounded-2xl bg-white/5" />
        <div className="h-14 w-full animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        data-testid="empty-activity-state"
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30 px-6 py-10 text-center"
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
          <Clock className="h-8 w-8 stroke-[1.5]" />
        </div>

        <h3 className="text-base font-semibold text-white tracking-tight">No transactions yet</h3>
        <p className="mt-1.5 max-w-[240px] text-xs text-slate-400 leading-relaxed">
          Your transaction activity will appear here once you send or receive assets.
        </p>

        {onReceive && (
          <button
            type="button"
            data-testid="receive-cta-btn"
            onClick={onReceive}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-95 shadow-md shadow-cyan-950/20"
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>Receive XLM</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-testid="history-list" className="space-y-2.5">
      {items.map((item) => (
        <div
          key={item.id}
          data-testid={`history-item-${item.id}`}
          role={onSelectItem ? 'button' : undefined}
          tabIndex={onSelectItem ? 0 : undefined}
          onClick={() => onSelectItem?.(item)}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 hover:bg-slate-900/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-300">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {item.label || item.kind || 'Transaction'}
              </p>
              {item.timestamp && <p className="text-[10px] text-slate-400">{item.timestamp}</p>}
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-white">{item.amount}</span>
        </div>
      ))}
    </div>
  );
}

export default HistoryList;
