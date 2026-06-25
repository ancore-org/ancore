import React from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-foreground/50">
      <div className="rounded bg-popover p-4 text-popover-foreground shadow-lg">
        {children}
        <button onClick={onClose} className="mt-4 text-destructive">
          Close
        </button>
      </div>
    </div>
  );
};
