import * as React from 'react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

export interface AmountInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /**
   * Current balance to display
   */
  balance?: string;
  /**
   * Asset symbol (e.g., 'XLM', 'USDC')
   */
  asset?: string;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Label for the input
   */
  label?: string;
}

/**
 * AmountInput - A specialized input component for cryptocurrency amounts
 * Displays balance, asset badge, and handles numeric input validation
 */
const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ balance, asset = 'XLM', error, label = 'Amount', className, ...props }, ref) => {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
          <Badge variant="outline">{asset}</Badge>
        </div>
        <Input type="number" step="any" placeholder="0.00" ref={ref} {...props} />
        <div className="flex items-center justify-between">
          {balance && (
            <p className="text-sm text-muted-foreground">
              Balance: {balance} {asset}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>
    );
  }
);
AmountInput.displayName = 'AmountInput';

export { AmountInput };
