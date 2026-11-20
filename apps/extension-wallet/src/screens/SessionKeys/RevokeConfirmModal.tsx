import React from 'react';
import { Dialog, Button } from '@ancore/ui-kit';

interface RevokeConfirmModalProps {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RevokeConfirmModal: React.FC<RevokeConfirmModalProps> = ({
  open,
  count,
  onConfirm,
  onCancel,
}) => (
  <Dialog isOpen={open} onClose={onCancel}>
    <div className="p-4 bg-card rounded" aria-labelledby="revoke-all-title">
      <h2 id="revoke-all-title" className="text-lg font-semibold mb-2">
        Revoke all session keys?
      </h2>
      <p className="text-sm mb-2">
        This will revoke {count} session {count === 1 ? 'key' : 'keys'}.
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Connected dApps using these keys will lose access and may stop working until you create new
        keys.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} autoFocus>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Revoke all
        </Button>
      </div>
    </div>
  </Dialog>
);

export default RevokeConfirmModal;
