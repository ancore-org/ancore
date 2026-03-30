import React from 'react';

const HomeScreen: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Main Account</p>
        <h2 className="mt-1 text-2xl font-bold text-white">0.00 XLM</h2>
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
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-3">Recent Activity</h3>
        <p className="text-center py-6 text-sm text-slate-500">No transactions yet</p>
      </section>
    </div>
  );
};

export default HomeScreen;
