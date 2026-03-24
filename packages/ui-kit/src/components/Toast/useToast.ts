import { useContext } from 'react';
import { NotificationContext } from './NotificationProvider';

export { type Toast, type ToastVariant } from './NotificationProvider';
export { useToast };

function useToast() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useToast must be used within a NotificationProvider');
  return ctx;
}
