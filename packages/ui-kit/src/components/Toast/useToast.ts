import { useContext } from 'react';
import { NotificationContext } from './NotificationProvider';

export { type ToastItem, type ToastVariant } from './NotificationProvider';
export { useToast };

function useToast() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useToast must be used within a NotificationProvider');

  const { toast } = ctx;
  return {
    toast,
    showSuccess: (message: string, duration?: number) => toast(message, 'success', duration),
    showError: (message: string, duration?: number) => toast(message, 'error', duration),
    showWarning: (message: string, duration?: number) => toast(message, 'warning', duration),
    showInfo: (message: string, duration?: number) => toast(message, 'info', duration),
  };
}
