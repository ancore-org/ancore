import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddSessionKeyDialog } from './AddSessionKeyDialog';
import { useSessionKeys } from '../../hooks/useSessionKeys';
import { SessionKeyRow } from '../../features/session-keys';

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
    <div className="p-4">
      <header className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="text-blue-500"
          aria-label="Go back"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">Session Keys</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="text-blue-500"
          aria-label="Add session key"
        >
          +
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 p-3 rounded bg-red-100 text-red-700 flex justify-between items-start"
        >
          <span>{error}</span>
          <button onClick={clearError} className="ml-2 font-bold" aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <section className="mb-4">
        <h2 className="text-lg font-semibold">What are session keys?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Session keys let apps act on your behalf with limited permissions and a fixed expiry — no
          main key exposure.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Active Keys</h2>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

        {!isLoading && sessionKeys.length === 0 && (
          <p className="text-sm text-gray-500">No session keys yet.</p>
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

      <button onClick={() => setDialogOpen(true)} className="mt-4 text-blue-500 text-sm">
        + Add Session Key
      </button>

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
