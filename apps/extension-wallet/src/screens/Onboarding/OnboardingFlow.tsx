import React from 'react';

export const Welcome: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-8 text-center h-full">
    <div className="mb-8 p-6 rounded-full bg-cyan-400/10 border border-cyan-400/30">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-12 h-12 text-cyan-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z"
        />
      </svg>
    </div>
    <h1 className="text-3xl font-bold text-white mb-4">Ancore</h1>
    <p className="text-slate-400 mb-8 leading-relaxed">
      Welcome to the future of decentralized asset management on Stellar.
    </p>
    <button className="w-full rounded-2xl bg-cyan-400 py-4 text-sm font-bold text-slate-950 transition hover:scale-[1.02] active:scale-95 shadow-[0_10px_30px_rgba(34,211,238,0.2)]">
      Get Started
    </button>
  </div>
);

export const Password: React.FC = () => (
  <div className="flex flex-col gap-6 p-6">
    <h2 className="text-2xl font-bold text-white">Create Password</h2>
    <p className="text-slate-400 text-sm">
      Ensure your password is strong and secure. It will be used to encrypt your vault.
    </p>
    <div className="space-y-4">
      <input
        type="password"
        placeholder="New password"
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none transition"
      />
      <input
        type="password"
        placeholder="Confirm password"
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none transition"
      />
      <button className="w-full rounded-2xl bg-cyan-400 py-3 mt-4 text-sm font-bold text-slate-950 hover:bg-cyan-300">
        Continue
      </button>
    </div>
  </div>
);

export const DeployPlaceholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-6 text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mb-6"></div>
    <h2 className="text-xl font-bold text-white mb-2">Deploying Account</h2>
    <p className="text-slate-400 text-sm italic">
      Your smart contract account is being initialized on the network...
    </p>
  </div>
);
