import React from 'react';
import { SessionPermission } from '@ancore/types';
import {
  ALL_SESSION_PERMISSIONS,
  formatPermissionLabel,
  hasPermission,
  togglePermission,
} from '@ancore/account-abstraction';

interface PermissionSelectorProps {
  /** Selected permission bitmask. */
  value: number;
  onChange: (bitmask: number) => void;
  className?: string;
}

const PERMISSION_OPTIONS: { label: string; value: SessionPermission }[] =
  ALL_SESSION_PERMISSIONS.map((permission) => ({
    value: permission,
    label: formatPermissionLabel(permission),
  }));

export const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  return (
    <div className={className}>
      {PERMISSION_OPTIONS.map(({ label, value: permission }) => (
        <label key={permission} className="block mb-2">
          <input
            type="checkbox"
            checked={hasPermission(value, permission)}
            onChange={() => onChange(togglePermission(value, permission))}
            className="mr-2"
          />
          {label}
        </label>
      ))}
    </div>
  );
};

export default PermissionSelector;
