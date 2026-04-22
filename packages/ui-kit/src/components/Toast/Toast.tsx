import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const toastVariants = cva(
  'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md text-sm w-80 pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-200',
  {
    variants: {
      variant: {
        success: 'bg-green-50 border-green-200 text-green-900',
        error: 'bg-red-50 border-red-200 text-red-900',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
        info: 'bg-blue-50 border-blue-200 text-blue-900',
      },
    },
    defaultVariants: { variant: 'info' },
  }
);

const icons = {
  success: <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />,
  error: <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />,
  warning: <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />,
  info: <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />,
};

export interface ToastProps extends VariantProps<typeof toastVariants> {
  id: string;
  message: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, message, variant = 'info', onDismiss }: ToastProps) {
  return (
    <div role="alert" className={cn(toastVariants({ variant }))}>
      {icons[variant!]}
      <span className="flex-1">{message}</span>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
