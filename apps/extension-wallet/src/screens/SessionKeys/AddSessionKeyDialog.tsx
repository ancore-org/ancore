import React, { useState } from 'react';
import { Dialog, Button, Input } from '@ancore/ui-kit';
import { PermissionSelector } from '../../components/PermissionSelector';

interface AddSessionKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (key: { name: string; permissions: string[]; expiry: string }) => Promise<void>;
}

export const AddSessionKeyDialog: React.FC<AddSessionKeyDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [expiry, setExpiry] = useState('1d');
  const [loading, setLoading] = useState(false);

  // Added explicit types for event handlers and JSX elements
  const handleSave = async (): Promise<void> => {
    setLoading(true);
    try {
      await onSave({ name, permissions, expiry });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setExpiry(e.target.value);
  };

  return (
    <Dialog isOpen={open} onClose={onClose}>
      <div className="p-4">
        <label className="block mb-2 font-medium">Key Name</label>
        <Input
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          placeholder="Enter key name"
          className="mb-4"
        />

        <label className="block mb-2 font-medium">Permissions</label>
        <PermissionSelector
          selectedPermissions={permissions}
          onChange={setPermissions}
          className="mb-4"
        />

        <label className="block mb-2 font-medium">Expiry</label>
        <select
          title="Select expiry duration"
          value={expiry}
          onChange={handleExpiryChange}
          className="w-full border rounded p-2 mb-4"
        >
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="1w">1 Week</option>
          <option value="custom">Custom</option>
        </select>

        <div className="flex justify-end">
          <Button onClick={onClose} variant="secondary" className="mr-2">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={!name || permissions.length === 0}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default AddSessionKeyDialog;
