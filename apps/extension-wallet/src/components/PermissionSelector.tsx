import React from 'react';

interface PermissionSelectorProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  className?: string;
}

const availablePermissions = ['Read', 'Write', 'Execute', 'Admin'];

export const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  selectedPermissions,
  onChange,
  className,
}) => {
  const togglePermission = (permission: string) => {
    if (selectedPermissions.includes(permission)) {
      onChange(selectedPermissions.filter((p) => p !== permission));
    } else {
      onChange([...selectedPermissions, permission]);
    }
  };

  return (
    <div className={className}>
      {availablePermissions.map((permission) => (
        <label key={permission} className="block mb-2">
          <input
            type="checkbox"
            checked={selectedPermissions.includes(permission)}
            onChange={() => togglePermission(permission)}
            className="mr-2"
          />
          {permission}
        </label>
      ))}
    </div>
  );
};

export default PermissionSelector;
