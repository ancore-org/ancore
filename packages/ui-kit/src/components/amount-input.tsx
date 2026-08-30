import * as React from 'react';
import { AmountInputBase, type AmountInputBaseProps } from './Form/AmountInput';

export interface AmountInputProps extends Omit<
  AmountInputBaseProps,
  'onMax' | 'maxDisabled' | 'name'
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
 * Displays balance, asset badge, and handles numeric input validation.
 *
 * @deprecated This is a thin wrapper kept for backwards compatibility. It now
 * renders `AmountInputBase`, the same implementation behind `FormAmountInput`.
 * Import `FormAmountInput` instead — it additionally integrates with `Form`
 * via a `name` prop and supports a MAX shortcut.
 *
 * The previous implementation used a raw `type="number"` field with no input
 * sanitisation and no `aria-invalid` / `aria-describedby` wiring, which made
 * it the less accessible of two similarly named exports for money amounts.
 */
const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>((props, ref) => (
  <AmountInputBase ref={ref} {...props} />
));
AmountInput.displayName = 'AmountInput';

export { AmountInput };
