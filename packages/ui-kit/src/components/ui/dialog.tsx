import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Legacy props
  isOpen?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onOpenChange,
  isOpen,
  onClose,
  children,
}) => {
  const isDialogVisible = open !== undefined ? open : isOpen;
  const dialogRef = useRef<HTMLDialogElement>(null);

  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isDialogVisible) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isDialogVisible]);

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    handleClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose();
    }
  };

  if (isDialogVisible === undefined) {
    return <>{children}</>;
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className={cn(
        'backdrop:bg-foreground/50 bg-transparent p-0 m-auto overflow-visible',
        'open:animate-in open:fade-in-0 backdrop:animate-in backdrop:fade-in-0'
      )}
    >
      {children}
    </dialog>
  );
};

export const DialogContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div
      className={cn('rounded bg-popover p-4 text-popover-foreground shadow-lg relative', className)}
    >
      {children}
    </div>
  );
};
