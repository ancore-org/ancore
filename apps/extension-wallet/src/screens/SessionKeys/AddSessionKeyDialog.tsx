import React, { useState } from 'react';
import { Dialog, Button, Input } from '@ancore/ui-kit';
import { SessionPermission } from '../../hooks/useSessionKeys';
import type { AddSessionKeyInput } from '../../hooks/useSessionKeys';

interface AddSessionKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: AddSessionKeyInput) => Promise<void>;
}

const PERMISSION_OPTIONS: { label: string; value: SessionPermission }[] = [
  { label: 'Send Payment', value: SessionPermission.SEND_PAYMENT },
  { label: 'Manage Data', value: SessionPermission.MANAGE_DATA },
  { label: 'Invoke Contract', value: SessionPermission.INVOKE_CONTRACT },
];

function expiryDurationToMs(expiry: string): number {
  const now = Date.now();
  switch (expiry) {
    case '1h':  return now + 60 * 60 * 1000;
    case '1d':  return now + 24 * 60 * 60 * 1000;
    case '1w':  return now + 7 * 24 * 60 * 60 * 1000;
    case '30d': return now + 30 * 24 * 60 * 60 * 1000;
    default:    return now + 24 * 60 * 60 * 1000;
  }
}

export const AddSessionKeyDialog: React.FC<AddSessionKeyDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [permissions, setPermissions] = useState<SessionPermission[]>([]);
  const [expiry, setExpiry] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (value: SessionPermission) => {
    setPermissions((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    );
  };

  const handleSave = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await onSave({ label, permissions, expiresAt: expiryDurationToMs(expiry) });
      setLabel('');
      setPermissions([]);
      setExpiry('1d');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog isOpen={open} onClose={onClose}>
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Add Session Key</h2>

        <label className="block mb-2 font-medium">Key Name</label>
        <Input
          value={label}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
          placeholder="e.g. Trading Bot"
          className="mb-4"
        />

        <label className="block mb-2 font-medium">Permissions</label>
        <div className="mb-4 space-y-2">
          {PERMISSION_OPTIONS.map(({ label: pLabel, value }) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permissions.includes(value)}
                onChange={() => togglePermission(value)}
                aria-label={pLabel}
              />
              {pLabel}
            </label>
          ))}
        </div>

        <label className="block mb-2 font-medium">Expiry</label>
        <select
          title="Select expiry duration"
          value={expiry}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setExpiry(e.target.value)}
          className="w-full border rounded p-2 mb-4"
        >
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="1w">1 Week</option>
          <option value="30d">30 Days</option>
        </select>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={!label || permissions.length === 0}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default AddSessionKeyDialog;
