import * as React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ErrorFallback';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
  onGoHome?: () => void;
  onGoToSettings?: () => void;
  onReport?: (errorId: string, sanitizedMessage: string) => void;
}

const SENSITIVE_PATTERNS = [/secret/i, /private.?key/i, /mnemonic/i, /seed/i, /passphrase/i];

export function sanitizeMessage(message: string): string {
  // If message contains any Stellar secret key (56 characters starting with S)
  if (/\bS[A-Z2-7]{55}\b/i.test(message)) {
    return '[redacted — potentially sensitive content]';
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return '[redacted — potentially sensitive content]';
    }
  }
  return message;
}

function generateErrorId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ERR-${ts}-${rand}`;
}

export function ErrorBoundary({
  children,
  onReset,
  onGoHome,
  onGoToSettings,
  onReport,
}: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      onReset={onReset}
      fallbackRender={({ error, resetErrorBoundary }) => {
        const errorId = generateErrorId();
        const rawMessage = error instanceof Error ? error.message : String(error);
        const sanitizedMessage = sanitizeMessage(rawMessage);

        // Safe logging - log sanitized message only, no sensitive key material
        console.error('[ErrorBoundary]', { errorId, message: sanitizedMessage });

        return (
          <ErrorFallback
            error={new Error(sanitizedMessage)}
            errorId={errorId}
            onReset={resetErrorBoundary}
            onGoHome={
              onGoHome
                ? () => {
                    resetErrorBoundary();
                    onGoHome();
                  }
                : undefined
            }
            onGoToSettings={
              onGoToSettings
                ? () => {
                    resetErrorBoundary();
                    onGoToSettings();
                  }
                : undefined
            }
            onReport={onReport}
          />
        );
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
