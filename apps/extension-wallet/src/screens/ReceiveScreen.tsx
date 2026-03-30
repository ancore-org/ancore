import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface ReceiveScreenProps {
  account?: {
    publicKey: string;
    name?: string;
  };
  network?: 'mainnet' | 'testnet' | 'futurenet';
  onBack?: () => void;
}

export const ReceiveScreen: React.FC<ReceiveScreenProps> = ({
  account,
  network = 'mainnet',
  onBack,
}) => {
  const [copied, setCopied] = React.useState(false);
  const publicKey = account?.publicKey ?? 'GA7W...A3XY';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center gap-12 bg-slate-900 shadow-2xl rounded-3xl border border-white/10 m-4">
      {onBack && (
        <button
          aria-label="Go back"
          onClick={onBack}
          className="self-start text-xs text-cyan-300 underline"
        >
          Back
        </button>
      )}
      <h2 className="text-xl font-black text-white uppercase tracking-widest bg-cyan-400/10 px-6 py-2 rounded-full border border-cyan-400/20">
        Receive Assets
      </h2>
      <p className="text-xs text-slate-400">
        {network === 'mainnet' ? 'Mainnet' : network === 'testnet' ? 'Testnet' : 'Futurenet'}
      </p>

      <div className="p-10 bg-white rounded-3xl border-8 border-cyan-400/20 shadow-2xl group hover:border-cyan-400 transition-all cursor-pointer">
        <div className="w-48 h-48 bg-slate-900/5 flex items-center justify-center relative shadow-inner">
          <QRCodeSVG value={publicKey} aria-label="Account QR code" />
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Your address
        </label>
        {account?.name && <p className="text-xs text-slate-300">{account.name}</p>}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative group hover:border-cyan-400/50 transition-all">
          <p className="text-[11px] font-mono text-cyan-300 break-all leading-relaxed bg-cyan-950/20 p-4 rounded-xl border border-cyan-400/20 mb-4 shadow-inner">
            {publicKey}
          </p>
          <button
            className="w-full rounded-2xl bg-cyan-400 py-4 text-[10px] font-black text-slate-950 shadow-[0_10px_25px_rgba(34,211,238,0.2)] hover:bg-cyan-300 active:scale-95 transition-all uppercase tracking-[0.2em]"
            aria-label="Copy address"
            onClick={() => void handleCopy()}
          >
            {copied ? 'Copied' : 'Copy Address'}
          </button>
          <button
            className="mt-2 w-full rounded-2xl border border-cyan-300 py-3 text-[10px] font-black text-cyan-200 uppercase tracking-[0.2em]"
            aria-label="Print QR code"
            onClick={() => window.print()}
          >
            Print QR code
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveScreen;
