import React, { useState } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { Dialog, Button, Input } from '@ancore/ui-kit';
import { SessionPermission } from '../../hooks/useSessionKeys';
import type { AddSessionKeyInput } from '../../hooks/useSessionKeys';
import { PermissionSelector } from '../../components/PermissionSelector';

interface AddSessionKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: AddSessionKeyInput) => Promise<void>;
}

export function validateContractId(value: string): string | null {
  if (StrKey.isValidContract(value)) return null;
  if (StrKey.isValidEd25519PublicKey(value)) {
    return 'Must be a valid Soroban contract ID (C...), not an account address (G...)';
  }
  return 'Must be a valid Soroban contract ID (C...)';
}

function expiryDurationToMs(expiry: string): number {
  const now = Date.now();
  switch (expiry) {
    case '1h':
      return now + 60 * 60 * 1000;
    case '1d':
      return now + 24 * 60 * 60 * 1000;
    case '1w':
      return now + 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now + 30 * 24 * 60 * 60 * 1000;
    default:
      return now + 24 * 60 * 60 * 1000;
  }
}

export const AddSessionKeyDialog: React.FC<AddSessionKeyDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [permissionsBitmask, setPermissionsBitmask] = useState<number>(0);
  const [expiry, setExpiry] = useState('1d');
  const [contractInput, setContractInput] = useState('');
  const [contractError, setContractError] = useState<string | null>(null);
  const [allowedContracts, setAllowedContracts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedContract = contractInput.trim();
  const canAddContract = trimmedContract !== '' && validateContractId(trimmedContract) === null;

  const handleContractChange = (value: string): void => {
    setContractInput(value);
    if (contractError) setContractError(validateContractId(value.trim()));
  };

  const handleContractBlur = (): void => {
    setContractError(trimmedContract === '' ? null : validateContractId(trimmedContract));
  };

  const handleAddContract = (): void => {
    if (!canAddContract) return;
    setAllowedContracts((prev) =>
      prev.includes(trimmedContract) ? prev : [...prev, trimmedContract]
    );
    setContractInput('');
    setContractError(null);
  };

  const handleSave = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Convert bitmask to array of permissions - this maintains compatibility with existing hook
      const permissionsArray: SessionPermission[] = [];
      if (permissionsBitmask & SessionPermission.SEND_PAYMENT)
        permissionsArray.push(SessionPermission.SEND_PAYMENT);
      if (permissionsBitmask & SessionPermission.MANAGE_DATA)
        permissionsArray.push(SessionPermission.MANAGE_DATA);
      if (permissionsBitmask & SessionPermission.INVOKE_CONTRACT)
        permissionsArray.push(SessionPermission.INVOKE_CONTRACT);

      await onSave({
        label,
        permissions: permissionsArray,
        expiresAt: expiryDurationToMs(expiry),
        allowedContracts,
      });
      setLabel('');
      setPermissionsBitmask(0);
      setExpiry('1d');
      setAllowedContracts([]);
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
        <PermissionSelector
          value={permissionsBitmask}
          onChange={setPermissionsBitmask}
          className="mb-4"
        />

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

        <label htmlFor="allowed-contract" className="block mb-2 font-medium">
          Contract address
        </label>
        <div className="flex gap-2 mb-1">
          <Input
            id="allowed-contract"
            value={contractInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleContractChange(e.target.value)
            }
            onBlur={handleContractBlur}
            placeholder="C..."
            aria-invalid={contractError !== null}
          />
          <Button onClick={handleAddContract} disabled={!canAddContract} variant="secondary">
            Add Contract
          </Button>
        </div>
        {contractError && (
          <p role="alert" className="text-red-500 text-sm mb-2">
            {contractError}
          </p>
        )}
        <ul className="mb-4 space-y-1">
          {allowedContracts.map((id) => (
            <li key={id} className="text-xs font-mono break-all">
              {id}
            </li>
          ))}
        </ul>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={!label || permissionsBitmask === 0}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default AddSessionKeyDialog;
