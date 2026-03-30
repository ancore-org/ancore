import React from 'react';

interface ReceiveScreenProps {
  account: {
    publicKey: string;
    name: string;
  };
  network: 'mainnet' | 'testnet' | 'futurenet';
  onBack: () => void;
}

const ReceiveScreen: React.FC<ReceiveScreenProps> = ({ account, network, onBack }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center gap-12 bg-slate-900 shadow-2xl rounded-3xl border border-white/10 m-4">
    <button onClick={onBack} className="text-blue-500 mb-4">
      ← Back
    </button>
    <h2 className="text-xl font-black text-white uppercase tracking-widest bg-cyan-400/10 px-6 py-2 rounded-full border border-cyan-400/20">
      Receive Assets
    </h2>

    <div className="p-10 bg-white rounded-3xl border-8 border-cyan-400/20 shadow-2xl group hover:border-cyan-400 transition-all cursor-pointer">
      <div className="w-48 h-48 bg-slate-900/5 flex items-center justify-center relative shadow-inner">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center px-4 animate-pulse">
          Payment QR Placeholder
        </span>
      </div>
    </div>

    <div className="flex flex-col gap-6 w-full">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        Your Stellar Address
      </label>
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative group hover:border-cyan-400/50 transition-all">
        <p className="text-[11px] font-mono text-cyan-300 break-all leading-relaxed bg-cyan-950/20 p-4 rounded-xl border border-cyan-400/20 mb-4 shadow-inner">
          {account.publicKey}
        </p>
        <button className="w-full rounded-2xl bg-cyan-400 py-4 text-[10px] font-black text-slate-950 shadow-[0_10px_25px_rgba(34,211,238,0.2)] hover:bg-cyan-300 active:scale-95 transition-all uppercase tracking-[0.2em]">
          Copy Address
        </button>
      </div>
    </div>

    <p className="text-sm text-slate-400 mt-4">Network: {network}</p>
  </div>
);

export default ReceiveScreen;
