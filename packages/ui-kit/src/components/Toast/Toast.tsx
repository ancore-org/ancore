import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const toastVariants = cva(
  'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md text-sm w-80 pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-200',
  {
    variants: {
      variant: {
        success: 'border-success/25 bg-success/10 text-foreground',
        error: 'border-destructive/25 bg-destructive/10 text-foreground',
        warning: 'border-warning/25 bg-warning/10 text-foreground',
        info: 'border-info/25 bg-info/10 text-foreground',
      },
    },
    defaultVariants: { variant: 'info' },
  }
);

const icons = {
  success: <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-success" />,
  error: <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />,
  warning: <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />,
  info: <Info className="h-4 w-4 mt-0.5 shrink-0 text-info" />,
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
