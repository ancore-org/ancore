/**
 * LoadingState Component
 *
 * Standardized loading state UI for async operations.
 * Provides consistent spinner and optional message.
 */

import React from 'react';

export interface LoadingStateProps {
  message?: string;
  fullHeight?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  fullHeight = true,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${fullHeight ? 'min-h-screen' : 'py-12'} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading content"
    >
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-slate-700/50 border-t-cyan-400 animate-spin" />
      </div>
      {message && (
        <p className="text-xs text-slate-400" aria-live="assertive">
          {message}
        </p>
      )}
    </div>
  );
};
