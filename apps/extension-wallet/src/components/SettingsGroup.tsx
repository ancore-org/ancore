import * as React from 'react';
import { ChevronRight } from 'lucide-react';

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <section className="space-y-1.5">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

interface SettingItemProps {
  label: string;
  description?: string;
  value?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  rightSlot?: React.ReactNode;
  icon?: React.ReactNode;
}

export function SettingItem({
  label,
  description,
  value,
  onClick,
  danger = false,
  rightSlot,
  icon,
}: SettingItemProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={[
        'flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors',
        onClick ? 'cursor-pointer hover:bg-accent/50 active:bg-accent' : '',
        danger ? 'text-destructive' : 'text-foreground',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      {icon && (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 text-left">
        <span className="block font-medium">{label}</span>
        {description && (
          <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
        )}
      </span>
      {rightSlot ?? (
        <>
          {value !== undefined && <span className="text-xs text-muted-foreground">{value}</span>}
          {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
        </>
      )}
    </Tag>
  );
}
