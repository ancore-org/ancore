import React from 'react';
import { useAccountBalance, formatBalance } from '@/hooks/useAccountBalance';

const HomeScreen: React.FC = () => {
  const { balance, isLoading, error, refreshBalance } = useAccountBalance();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p className="text-sm text-slate-400">{error.message}</p>
        <button
          onClick={() => refreshBalance()}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header
        className={`rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-opacity ${isLoading ? 'opacity-50' : 'opacity-100'}`}
      >
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Main Account</p>
        <h2 className="mt-1 text-2xl font-bold text-white">
          {isLoading ? '---' : formatBalance(balance)}
        </h2>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button className="rounded-2xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
          Send
        </button>
        <button className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
          Receive
        </button>
      </div>

      <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest">
            Recent Activity
          </h3>
          {isLoading && (
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <p className="text-center py-6 text-sm text-slate-500">No transactions yet</p>
      </section>
    </div>
  );
};

export default HomeScreen;
