import * as React from 'react';
import { AlertTriangle, ArrowLeft, Check, Wifi } from 'lucide-react';
import { Button } from '@ancore/ui-kit';
import type { Network } from '@ancore/types';

interface NetworkSettingsProps {
  value: Network;
  onChange: (network: Network) => void;
  onBack: () => void;
}

const NETWORKS: { value: Network; label: string; description: string; color: string }[] = [
  {
    value: 'testnet',
    label: 'Testnet',
    description: 'Safe for testing — no real funds',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  },
  {
    value: 'mainnet',
    label: 'Mainnet',
    description: 'Live network — real funds at risk',
    color: 'text-green-600 bg-green-50 border-green-200',
  },
];

export function NetworkSettings({ value, onChange, onBack }: NetworkSettingsProps) {
  const [pending, setPending] = React.useState<Network | null>(null);

  function handleSelect(network: Network) {
    if (network === value) return;
    if (network === 'mainnet') {
      setPending(network);
    } else {
      onChange(network);
      onBack();
    }
  }

  if (pending) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <ScreenHeader title="Switch Network" onBack={() => setPending(null)} />
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-destructive text-sm">Switch to Mainnet?</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Mainnet uses real funds. Transactions are irreversible. Only switch if you know what
                you are doing.
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              onChange(pending);
              setPending(null);
              onBack();
            }}
          >
            Yes, Switch to Mainnet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ScreenHeader title="Network" onBack={onBack} />
      <div className="flex flex-col gap-3 p-4">
        {NETWORKS.map((n) => {
          const active = value === n.value;
          return (
            <button
              key={n.value}
              onClick={() => handleSelect(n.value)}
              className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${n.color}`}
              >
                <Wifi className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{n.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
              </div>
              {active && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
      <button
        onClick={onBack}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h1 className="font-semibold text-base">{title}</h1>
    </div>
  );
}
