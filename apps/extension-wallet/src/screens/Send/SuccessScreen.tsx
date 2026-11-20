import React from 'react';
import { CheckCircle2, ExternalLink, ArrowLeft } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

export interface SuccessScreenProps {
  txId: string;
  amount?: string;
  assetCode?: string;
  recipient?: string;
  network?: string;
  onDone?: () => void;
}

export function SuccessScreen({
  txId,
  amount,
  assetCode = 'XLM',
  recipient,
  network = 'testnet',
  onDone,
}: SuccessScreenProps) {
  const explorerUrl =
    network.toLowerCase() === 'mainnet'
      ? `https://stellar.expert/explorer/public/tx/${txId}`
      : `https://stellar.expert/explorer/testnet/tx/${txId}`;

  return (
    <div className="wallet-sheet">
      <header className="wallet-header">
        <div>
          <p className="wallet-kicker">Transfer complete</p>
          <h1 className="wallet-title mt-1">Sent Successfully</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-5 pb-6 pt-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <div className="mt-6 text-center">
          {amount && (
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              {amount}{' '}
              <span className="text-lg font-normal text-muted-foreground">{assetCode}</span>
            </h2>
          )}
          {recipient && (
            <p className="mt-2 text-xs text-muted-foreground font-mono truncate max-w-[280px] mx-auto">
              To: {recipient}
            </p>
          )}
        </div>

        <section className="wallet-card mt-8 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Transaction Hash</span>
            <div className="flex items-center gap-2">
              <CopyButton text={txId} label="Copy Hash" testId="copy-hash-btn" />
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors lowercase"
              >
                <span>explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div
            data-testid="tx-hash-display"
            className="rounded-xl bg-background/50 border border-border/50 p-3 font-mono text-[11px] text-foreground break-all leading-relaxed select-all"
          >
            {txId}
          </div>
        </section>

        <div className="mt-auto pt-8">
          <button type="button" data-testid="done-btn" onClick={onDone} className="wallet-pill-btn">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Dashboard
          </button>
        </div>
      </main>
    </div>
  );
}
