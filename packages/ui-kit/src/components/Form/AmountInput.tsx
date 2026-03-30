import * as React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function useOptionalFormContext() {
  try {
    return useFormContext();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AmountInputBase – pure presentational layer
// ---------------------------------------------------------------------------

export interface AmountInputBaseProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** Field label */
  label?: string;
  /** Validation or runtime error message */
  error?: string;
  /** Current wallet balance to display */
  balance?: string;
  /** Asset symbol, e.g. "XLM" or "USDC" */
  asset?: string;
  /** Callback triggered when the user clicks "Max" */
  onMax?: () => void;
}

const AmountInputBase = React.forwardRef<HTMLInputElement, AmountInputBaseProps>(
  (
    { label = 'Amount', error, balance, asset = 'XLM', onMax, className, id, onChange, ...props },
    ref
  ) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    /** Strip characters that are not digits or a single decimal point. */
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Allow only digits and one decimal point
        const sanitised = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        if (sanitised !== raw) {
          e.target.value = sanitised;
        }
        onChange?.(e);
      },
      [onChange]
    );

    return (
      <div className={cn('space-y-2', className)}>
        {/* Label row */}
        <div className="flex items-center justify-between">
          <label
            htmlFor={inputId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
          <Badge variant="outline" aria-label={`Asset: ${asset}`}>
            {asset}
          </Badge>
        </div>

        {/* Input row */}
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              onMax && 'pr-14',
              error && 'border-destructive focus-visible:ring-destructive'
            )}
            onChange={handleChange}
            {...props}
          />
          {onMax && (
            <button
              type="button"
              onClick={onMax}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              MAX
            </button>
          )}
        </div>

        {/* Balance / error row */}
        <div className="flex items-center justify-between min-h-[1.25rem]">
          {balance ? (
            <p className="text-sm text-muted-foreground">
              Balance:{' '}
              <span className="font-medium">
                {balance} {asset}
              </span>
            </p>
          ) : (
            <span />
          )}
          {error && (
            <p
              id={`${inputId}-error`}
              role="alert"
              className="text-sm font-medium text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }
);
AmountInputBase.displayName = 'AmountInputBase';

// ---------------------------------------------------------------------------
// AmountInput – form-context-aware wrapper
// ---------------------------------------------------------------------------

export interface AmountInputProps extends AmountInputBaseProps {
  /**
   * Field name used to register with the parent Form.
   * When omitted the component acts as a standalone input.
   */
  name?: string;
}

/**
 * AmountInput (Form edition) – a specialized decimal input for transaction
 * amounts with balance display and optional MAX shortcut.
 *
 * Works standalone or inside a `<Form>` component. When a `name` prop is
 * provided inside a FormProvider the component auto-registers and mirrors
 * Zod validation errors.
 *
 * @example – inside a Form
 * ```tsx
 * <AmountInput name="amount" label="Amount" balance="100.50" asset="XLM" />
 * ```
 */
const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ name, ...props }, ref) => {
    const formCtx = useOptionalFormContext();

    if (formCtx && name) {
      return (
        <Controller
          control={formCtx.control}
          name={name}
          defaultValue=""
          render={({ field, fieldState }) => (
            <AmountInputBase
              {...props}
              {...field}
              ref={ref}
              error={props.error ?? fieldState.error?.message}
            />
          )}
        />
      );
    }

    return <AmountInputBase ref={ref} {...props} />;
  }
);
AmountInput.displayName = 'AmountInput';

export { AmountInput, AmountInputBase };
