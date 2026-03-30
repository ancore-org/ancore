import * as React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getPasswordStrength } from './validation';

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
// StrengthMeter – visualises password strength
// ---------------------------------------------------------------------------

interface StrengthMeterProps {
  password: string;
  id: string;
}

function StrengthMeter({ password, id }: StrengthMeterProps) {
  if (!password) return null;

  const strength = getPasswordStrength(password);

  return (
    <div aria-live="polite" aria-atomic="true" id={id}>
      {/* Progress bar */}
      <div
        className="h-1.5 w-full rounded-full bg-secondary overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={strength.percent}
        aria-label="Password strength"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', strength.bgClass)}
          style={{ width: `${strength.percent}%` }}
        />
      </div>

      {/* Label */}
      <p className={cn('text-xs font-medium mt-1', strength.colorClass)}>{strength.label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PasswordInputBase – pure presentational layer
// ---------------------------------------------------------------------------

export interface PasswordInputBaseProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** Field label */
  label?: string;
  /** Validation error message */
  error?: string;
  /** Show the password strength meter below the input */
  showStrength?: boolean;
}

const PasswordInputBase = React.forwardRef<HTMLInputElement, PasswordInputBaseProps>(
  ({ label = 'Password', error, showStrength = false, className, id, value, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    const strengthId = `${inputId}-strength`;

    const currentValue = typeof value === 'string' ? value : '';

    return (
      <div className={cn('space-y-2', className)}>
        <label
          htmlFor={inputId}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>

        {/* Input + toggle */}
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={!!error}
            aria-describedby={
              [error ? `${inputId}-error` : null, showStrength ? strengthId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={cn('pr-10', error && 'border-destructive focus-visible:ring-destructive')}
            value={value}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Strength meter */}
        {showStrength && <StrengthMeter password={currentValue} id={strengthId} />}

        {/* Error */}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);
PasswordInputBase.displayName = 'PasswordInputBase';

// ---------------------------------------------------------------------------
// PasswordInput – form-context-aware wrapper
// ---------------------------------------------------------------------------

export interface PasswordInputProps extends PasswordInputBaseProps {
  /**
   * Field name used to register with the parent Form.
   * Omit for standalone usage.
   */
  name?: string;
}

/**
 * PasswordInput – a password field with show/hide toggle and optional strength
 * meter. Works standalone or inside a `<Form>` component.
 *
 * @example – inside a Form
 * ```tsx
 * <PasswordInput name="password" label="Password" showStrength />
 * ```
 *
 * @example – standalone
 * ```tsx
 * <PasswordInput
 *   label="New Password"
 *   value={pw}
 *   onChange={(e) => setPw(e.target.value)}
 *   showStrength
 * />
 * ```
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ name, ...props }, ref) => {
    const formCtx = useOptionalFormContext();

    if (formCtx && name) {
      return (
        <Controller
          control={formCtx.control}
          name={name}
          defaultValue=""
          render={({ field, fieldState }) => (
            <PasswordInputBase
              {...props}
              {...field}
              ref={ref}
              error={props.error ?? fieldState.error?.message}
            />
          )}
        />
      );
    }

    return <PasswordInputBase ref={ref} {...props} />;
  }
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput, PasswordInputBase, StrengthMeter };
