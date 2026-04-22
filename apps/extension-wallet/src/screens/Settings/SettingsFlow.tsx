import React from 'react';

export const SettingsScreen: React.FC = () => (
  <div className="flex flex-col gap-8 p-6">
    <header className="flex justify-between items-center mb-4">
      <h1 className="text-xl font-black text-white uppercase tracking-widest text-[14px]">
        Wallet Settings
      </h1>
    </header>

    <nav className="space-y-4">
      {[
        { label: 'Network', value: 'Mainnet', icon: '🌐' },
        { label: 'Security', value: 'Password Set', icon: '🛡️' },
        { label: 'Auto Lock', value: '5 Minutes', icon: '🔒' },
        { label: 'Display Currency', value: 'USD', icon: '💰' },
        { label: 'About', value: 'v0.1.0-alpha', icon: 'ℹ️' },
      ].map((link, i) => (
        <article
          key={i}
          className="flex justify-between items-center bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 hover:border-cyan-400/20 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <span className="text-lg bg-white/5 p-2 rounded-xl group-hover:scale-110 transition-transform">
              {link.icon}
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">
              {link.label}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 group-hover:translate-x-1 transition-transform">
            {link.value}
          </span>
        </article>
      ))}
    </nav>

    <button className="w-full rounded-2xl border border-red-500/20 bg-red-500/5 py-4 text-[10px] font-black text-red-400 hover:bg-red-500/10 transition uppercase tracking-widest">
      Lock Wallet Now
    </button>
  </div>
);
