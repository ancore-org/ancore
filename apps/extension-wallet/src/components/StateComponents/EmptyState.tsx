/**
 * EmptyState Component
 *
 * Standardized empty state UI for screens with no data.
 * Provides consistent messaging, icon, and optional action.
 */

import React from 'react';
import { Icon } from 'lucide-react';

export interface EmptyStateProps {
  icon?: Icon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`Empty state: ${title}`}
    >
      {IconComponent && (
        <div className="p-4 rounded-full bg-slate-700/30 border border-slate-600/30">
          <IconComponent className="w-8 h-8 text-slate-400" aria-hidden="true" />
        </div>
      )}

      <div className="gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 transition focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          aria-label={action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
