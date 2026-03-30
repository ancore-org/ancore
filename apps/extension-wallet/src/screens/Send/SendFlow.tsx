import React from 'react';

export const SendForm: React.FC = () => (
  <form className="flex flex-col gap-6 p-4">
    <div className="space-y-4">
      <label className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
        Recipient Address
      </label>
      <input
        placeholder="G..."
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600"
      />
    </div>

    <div className="space-y-4">
      <label className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
        Amount XLM
      </label>
      <div className="relative">
        <input
          type="number"
          placeholder="0.00"
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600"
        />
        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 font-bold text-xs uppercase tracking-widest px-2 py-1 rounded bg-cyan-400/10">
          MAX
        </button>
      </div>
    </div>

    <button className="w-full rounded-3xl bg-cyan-400 py-5 mt-6 text-sm font-black text-slate-950 shadow-[0_15px_30px_rgba(34,211,238,0.15)] uppercase tracking-widest transition hover:scale-[1.01]">
      Review Details
    </button>
  </form>
);

export const Review: React.FC = () => (
  <div className="flex flex-col gap-8 p-6 bg-slate-900 shadow-2xl rounded-3xl border border-white/10">
    <h2 className="text-xl font-bold text-white uppercase tracking-widest text-center">
      Confirm Send
    </h2>

    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">Amount</span>
        <span className="text-white font-black">10.00 XLM</span>
      </div>
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">Fee</span>
        <span className="text-emerald-400 font-bold">0.00001 XLM</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">To</span>
        <span className="text-[11px] text-cyan-300 font-mono break-all leading-relaxed bg-cyan-950/30 p-3 rounded-xl border border-cyan-400/20">
          GA7W...A3XY
        </span>
      </div>
    </div>

    <button className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-black text-slate-950 hover:bg-cyan-300 transition-all shadow-[0_10px_25px_rgba(34,211,238,0.2)]">
      Confirm & Sign
    </button>
  </div>
);

export const Status: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-12 text-center h-[300px]">
    <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-4 border-emerald-500 flex items-center justify-center mb-8 animate-pulse shadow-[0_0_50px_rgba(16,185,129,0.3)]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-10 h-10 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">
      Sent Successfully
    </h2>
    <p className="text-slate-400 text-xs mb-8 font-medium">Tx hash: GA72...X124</p>
    <button className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-xs font-black text-white hover:bg-white/10 transition">
      Close Panel
    </button>
  </div>
);
