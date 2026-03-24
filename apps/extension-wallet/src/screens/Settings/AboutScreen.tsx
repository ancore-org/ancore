import * as React from 'react';
import { ExternalLink, Github, MessageCircle, Bug, Heart } from 'lucide-react';
import { ScreenHeader } from './NetworkSettings';

const APP_VERSION = '0.1.0';

interface AboutScreenProps {
  onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ScreenHeader title="About" onBack={onBack} />

      <div className="flex flex-col gap-5 p-4">
        {/* App identity card */}
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-100 border border-primary/20 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-2xl font-bold shadow-lg shadow-primary/30">
            A
          </div>
          <div>
            <p className="font-bold text-lg">Ancore Wallet</p>
            <p className="text-sm text-muted-foreground">Account abstraction for Stellar</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            v{APP_VERSION}
          </span>
        </div>

        {/* Links */}
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Resources
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
            <LinkItem
              icon={<Github className="h-4 w-4" />}
              label="Documentation"
              href="https://github.com/ancore-org/ancore"
            />
            <LinkItem
              icon={<MessageCircle className="h-4 w-4" />}
              label="Telegram Community"
              href="https://t.me/+OqlAx-gQx3M4YzJk"
            />
            <LinkItem
              icon={<Bug className="h-4 w-4" />}
              label="Report a Bug"
              href="https://github.com/ancore-org/ancore/issues"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1.5 pt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Built with</span>
            <Heart className="h-3 w-3 text-red-400 fill-red-400" />
            <span>on Stellar / Soroban</span>
          </div>
          <p className="text-xs text-muted-foreground">Apache-2.0 OR MIT</p>
        </div>
      </div>
    </div>
  );
}

function LinkItem({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-accent/50 transition-colors"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50" />
    </a>
  );
}
