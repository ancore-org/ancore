import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { Badge, cn } from '@ancore/ui-kit';
import { AlertCircle, CheckCircle2, Clock3, XCircle } from 'lucide-react';
const STATUS_STYLES = {
  confirmed: {
    label: 'Confirmed',
    icon: _jsx(CheckCircle2, { className: 'h-4 w-4', 'aria-hidden': 'true' }),
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  pending: {
    label: 'Pending',
    icon: _jsx(Clock3, { className: 'h-4 w-4', 'aria-hidden': 'true' }),
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  failed: {
    label: 'Failed',
    icon: _jsx(XCircle, { className: 'h-4 w-4', 'aria-hidden': 'true' }),
    className:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300',
  },
  cancelled: {
    label: 'Cancelled',
    icon: _jsx(AlertCircle, { className: 'h-4 w-4', 'aria-hidden': 'true' }),
    className:
      'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  },
};
export function TransactionStatus({ status, className, ...props }) {
  const { label, icon, className: statusClassName } = STATUS_STYLES[status];
  return _jsxs(Badge, {
    variant: 'outline',
    className: cn(
      'inline-flex items-center gap-2 rounded-full px-3 py-1',
      statusClassName,
      className
    ),
    ...props,
    children: [icon, _jsx('span', { children: label })],
  });
}
//# sourceMappingURL=TransactionStatus.js.map
