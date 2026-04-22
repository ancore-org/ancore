import React, { useState } from 'react';
import { AddSessionKeyDialog } from './AddSessionKeyDialog';
import { useSessionKeys } from '../../hooks/useSessionKeys';
import { Tooltip } from '@ancore/ui-kit';

export const SessionKeysScreen: React.FC = () => {
  const { sessionKeys, revokeSessionKey } = useSessionKeys();
  const [isDialogOpen, setDialogOpen] = useState(false);

  const handleRevoke = async (keyId: string) => {
    await revokeSessionKey(keyId);
  };

  return (
    <div className="p-4">
      <header className="flex justify-between items-center mb-4">
        <button onClick={() => window.history.back()} className="text-blue-500">
          ← Back
        </button>
        <h1 className="text-xl font-bold">Session Keys</h1>
        <button onClick={() => setDialogOpen(true)} className="text-blue-500">
          +
        </button>
      </header>

      {/* Added educational tooltips to explain session keys */}
      <section className="mb-4">
        <h2 className="text-lg font-semibold">What are session keys?</h2>
        <Tooltip content="Session keys allow you to perform transactions securely without sharing your main key. They can have specific permissions and expiry times.">
          <button className="text-blue-500">Learn More</button>
        </Tooltip>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Active Keys</h2>
        {sessionKeys.length === 0 ? (
          <p>No active session keys.</p>
        ) : (
          <ul>
            {sessionKeys.map((key) => (
              <li key={key.publicKey} className="mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">🔑 {key.label || 'Unnamed Key'}</p>
                    <p className="text-sm">Permissions: {key.permissions.join(', ')}</p>
                    <p className="text-sm">Expires: {new Date(key.expiresAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => handleRevoke(key.publicKey)} className="text-red-500">
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button onClick={() => setDialogOpen(true)} className="mt-4 text-blue-500">
        + Add Session Key
      </button>

      <AddSessionKeyDialog
        open={isDialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={async (key) => {
          console.log('Saving key:', key);
        }}
      />
    </div>
  );
};

export default SessionKeysScreen;
