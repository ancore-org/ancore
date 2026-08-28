import React from 'react';
import { KeyRound } from 'lucide-react';

interface SessionKey {
  id: string;
  name: string;
  status: 'active' | 'expired';
  expiry: string;
  address: string;
}

interface SessionKeysListProps {
  keys?: SessionKey[];
  onNewKey?: () => void;
}

export const SessionKeysList: React.FC<SessionKeysListProps> = ({ keys = [], onNewKey }) => (
  <div className="flex flex-col gap-6 p-4">
    <header className="flex justify-between items-center mb-2">
      <h2 className="text-sm font-black text-white uppercase tracking-widest text-slate-500">
        Active Sessions
      </h2>
      <button
        onClick={onNewKey}
        className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-3 py-1.5 rounded-full border border-cyan-400/20 hover:bg-cyan-400/20 transition-all"
      >
        New Key
      </button>
    </header>

    {keys.length === 0 ? (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 py-12 text-center"
      >
        <KeyRound className="h-10 w-10 text-slate-600 opacity-50" aria-hidden />
        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
          No session keys
        </p>
        <p className="text-[11px] text-slate-600 max-w-[200px] leading-relaxed">
          Grant limited, expiring access to dApps without exposing your main key.
        </p>
        <button
          onClick={onNewKey}
          className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-4 py-2 rounded-full border border-cyan-400/20 hover:bg-cyan-400/20 transition-all"
        >
          Create Session Key
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        {keys.map((k) =>
          k.status === 'active' ? (
            <article
              key={k.id}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm group hover:border-cyan-400/30 transition-all cursor-pointer shadow-lg hover:shadow-cyan-400/5"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] bg-cyan-400/10 px-2 py-0.5 rounded">
                  Active
                </span>
                <span className="text-[10px] text-slate-500 font-mono tracking-widest">
                  EXP: {k.expiry}
                </span>
              </div>
              <h4 className="text-white font-black text-sm uppercase tracking-widest mb-1 group-hover:text-cyan-400 transition-colors underline-offset-8">
                {k.name}
              </h4>
              <p className="text-[10px] text-slate-400/80 font-mono break-all leading-relaxed line-clamp-2">
                {k.address}
              </p>
            </article>
          ) : (
            <article
              key={k.id}
              className="rounded-3xl border border-white/10 bg-white/5/50 p-5 grayscale opacity-60 backdrop-blur-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/5 px-2 py-0.5 rounded">
                  Expired
                </span>
                <span className="text-[10px] text-slate-700 font-mono tracking-widest">
                  EXP: {k.expiry}
                </span>
              </div>
              <h4 className="text-slate-500 font-black text-sm uppercase tracking-widest mb-1">
                {k.name}
              </h4>
              <p className="text-[10px] text-slate-700 font-mono break-all line-clamp-1">
                {k.address}
              </p>
            </article>
          )
        )}
      </div>
    )}
  </div>
);

export const AddKeyPlaceholder: React.FC = () => (
  <div className="flex flex-col gap-8 p-8 bg-slate-900 shadow-2xl rounded-3xl border border-white/10">
    <h2 className="text-xl font-black text-white uppercase tracking-widest text-center">
      New Session Key
    </h2>
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
          Session Name
        </label>
        <input
          placeholder="e.g. My Decentralized App"
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600"
        />
      </div>

      <div className="space-y-3">
        <label className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">
          Expiration (Days)
        </label>
        <input
          type="number"
          defaultValue="30"
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600"
        />
      </div>
    </div>
    <button className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-black text-slate-950 hover:bg-cyan-300 transition-all shadow-[0_10px_25px_rgba(34,211,238,0.2)] uppercase tracking-widest">
      Authorize Now
    </button>
  </div>
);
