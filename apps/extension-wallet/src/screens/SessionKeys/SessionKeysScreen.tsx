import React, { useState } from 'react';
import { AddSessionKeyDialog } from './AddSessionKeyDialog';
import { useSessionKeys, SessionPermission } from '../../hooks/useSessionKeys';

const PERMISSION_LABELS: Record<SessionPermission, string> = {
  [SessionPermission.SEND_PAYMENT]: 'Send Payment',
  [SessionPermission.MANAGE_DATA]: 'Manage Data',
  [SessionPermission.INVOKE_CONTRACT]: 'Invoke Contract',
};

function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

export const SessionKeysScreen: React.FC = () => {
  const { sessionKeys, isLoading, error, addSessionKey, revokeSessionKey, clearError } =
    useSessionKeys();
  const [isDialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="p-4">
      <header className="flex justify-between items-center mb-4">
        <button onClick={() => window.history.back()} className="text-blue-500">
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
          Session keys let apps act on your behalf with limited permissions and a fixed expiry —
          no main key exposure.
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
            {sessionKeys.map((key) => {
              const expired = isExpired(key.expiresAt);
              return (
                <li
                  key={key.publicKey}
                  className="flex justify-between items-start rounded border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {key.label || 'Unnamed Key'}
                      <span
                        className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                          expired ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {expired ? 'Expired' : 'Active'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {key.publicKey.slice(0, 8)}…{key.publicKey.slice(-6)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Permissions:{' '}
                      {key.permissions
                        .map((p) => PERMISSION_LABELS[p] ?? String(p))
                        .join(', ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      Expires: {new Date(key.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeSessionKey(key.publicKey)}
                    className="text-red-500 text-sm ml-4"
                    aria-label={`Revoke ${key.label ?? key.publicKey}`}
                  >
                    Revoke
                  </button>
                </li>
              );
            })}
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
