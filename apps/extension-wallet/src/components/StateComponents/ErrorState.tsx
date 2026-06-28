/**
 * ErrorState Component
 *
 * Standardized error state UI for failed operations.
 * Provides consistent error messaging, icon, and recovery actions.
 */

import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }>;
  className?: string;
  onDismiss?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  actions,
  className = '',
  onDismiss,
}) => {
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorRef.current && !onDismiss) {
      errorRef.current.focus();
    }
  }, [onDismiss]);

  return (
    <div
      ref={errorRef}
      className={`flex flex-col items-center justify-center p-6 text-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 ${className}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
    >
      <div className="p-3 rounded-full bg-red-500/10 border border-red-500/20">
        <AlertTriangle className="w-6 h-6 text-red-500" aria-hidden="true" />
      </div>

      <div className="gap-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{message}</p>
      </div>

      {actions && actions.length > 0 && (
        <div className="flex gap-2 w-full">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${
                action.variant === 'secondary'
                  ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10 focus:ring-white'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 focus:ring-cyan-400'
              }`}
              aria-label={action.label}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-2 py-1"
          aria-label="Dismiss error"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};
