import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddSessionKeyDialog } from './AddSessionKeyDialog';
import { useSessionKeys } from '../../hooks/useSessionKeys';
import { SessionKeyRow } from '../../features/session-keys';
import { ArrowLeft, KeyRound, Plus, X } from 'lucide-react';

export const SessionKeysScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    sessionKeys,
    isLoading,
    error,
    addSessionKey,
    revokeSessionKey,
    refreshSessionKey,
    clearError,
  } = useSessionKeys();
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="wallet-sheet p-5">
      <header className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="wallet-icon-btn bg-card"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setDialogOpen(true)}
          className="wallet-icon-btn bg-card"
          aria-label="Add session key"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <div className="mb-7">
        <p className="wallet-kicker">Permissions</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">Session keys</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Let apps act with limited permissions without exposing your main key.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="wallet-status-error mb-4 flex items-start justify-between rounded-xl border p-3"
        >
          <span>{error}</span>
          <button onClick={clearError} className="ml-2" aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Active keys</h2>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && sessionKeys.length === 0 && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-medium">No session keys yet</p>
            <p className="text-xs text-muted-foreground">
              Session keys let apps act on your behalf with limited permissions and a fixed expiry.
            </p>
            <button
              onClick={() => setDialogOpen(true)}
              className="wallet-pill-btn mt-2 h-11 px-5 text-sm"
            >
              Create Session Key
            </button>
          </div>
        )}

        {!isLoading && sessionKeys.length > 0 && (
          <ul className="space-y-3">
            {sessionKeys.map((key) => (
              <SessionKeyRow
                key={key.publicKey}
                sessionKey={key}
                onRevoke={revokeSessionKey}
                onRefresh={refreshSessionKey}
              />
            ))}
          </ul>
        )}
      </section>

      {sessionKeys.length > 0 && (
        <button
          onClick={() => setDialogOpen(true)}
          className="wallet-pill-btn-secondary mt-4 h-11 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add session key
        </button>
      )}

      <AddSessionKeyDialog
        open={isDialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={async (input) => {
          await addSessionKey(input);
          setDialogOpen(false);
        }}
      />
    </div>
  );
};

export default SessionKeysScreen;
