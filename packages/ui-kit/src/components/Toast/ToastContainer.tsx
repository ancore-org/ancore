import * as React from 'react';
import { Toast } from './Toast';
import type { ToastItem } from './NotificationProvider';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none"
    >
      {toasts.map((t) => (
        <Toast key={t.id} id={t.id} message={t.message} variant={t.variant} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
