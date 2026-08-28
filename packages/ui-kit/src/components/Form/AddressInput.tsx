import * as React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Safely attempt to read the react-hook-form context without throwing. */
function useOptionalFormContext() {
  try {
    return useFormContext();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// AddressInputBase – the pure presentational layer
// ---------------------------------------------------------------------------

export interface RecentRecipientPick {
  address: string;
  name?: string;
}

export interface AddressInputBaseProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** Field label */
  label?: string;
  /** Validation error message */
  error?: string;
  /** List of recent recipients to show as quick picks */
  recentRecipients?: RecentRecipientPick[];
  /** Callback when a recent recipient is selected */
  onSelectRecent?: (address: string) => void;
}

const AddressInputBase = React.forwardRef<HTMLInputElement, AddressInputBaseProps>(
  (
    { label = 'Address', error, className, id, recentRecipients, onSelectRecent, ...props },
    ref
  ) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('space-y-2', className)}>
        <label
          htmlFor={inputId}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
        <Input
          ref={ref}
          id={inputId}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'font-mono text-sm',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          {...props}
        />

        {recentRecipients && recentRecipients.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
            {recentRecipients.map((recipient) => (
              <button
                key={recipient.address}
                type="button"
                onClick={() => onSelectRecent?.(recipient.address)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <div className="h-1 w-1 rounded-full bg-primary/50" />
                {recipient.name ||
                  recipient.address.slice(0, 4) + '...' + recipient.address.slice(-4)}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }
);
AddressInputBase.displayName = 'AddressInputBase';

// ---------------------------------------------------------------------------
// AddressInput – form-context-aware wrapper
// ---------------------------------------------------------------------------

export interface AddressInputProps extends AddressInputBaseProps {
  /**
   * Field name used to register with the parent Form.
   * When omitted the component acts as an uncontrolled standalone input.
   */
  name?: string;
}

/**
 * AddressInput – a styled text input for Stellar public-key addresses.
 *
 * When rendered inside a `<Form>` component (i.e. inside a react-hook-form
 * `FormProvider`) with a `name` prop the component auto-registers itself and
 * displays validation errors from the form schema.
 *
 * @example – inside a Form
 * ```tsx
 * <AddressInput name="recipient" label="Send To" placeholder="GABC..." />
 * ```
 *
 * @example – standalone
 * ```tsx
 * <AddressInput
 *   label="Recipient"
 *   value={addr}
 *   onChange={(e) => setAddr(e.target.value)}
 *   error={addrError}
 * />
 * ```
 */
const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(
  ({ name, recentRecipients, onSelectRecent, ...props }, ref) => {
    const formCtx = useOptionalFormContext();

    if (formCtx && name) {
      return (
        <Controller
          control={formCtx.control}
          name={name}
          defaultValue=""
          render={({ field, fieldState }) => (
            <AddressInputBase
              {...props}
              {...field}
              ref={ref}
              recentRecipients={recentRecipients}
              onSelectRecent={(address) => {
                field.onChange(address);
                onSelectRecent?.(address);
              }}
              error={props.error ?? fieldState.error?.message}
            />
          )}
        />
      );
    }

    return (
      <AddressInputBase
        ref={ref}
        recentRecipients={recentRecipients}
        onSelectRecent={onSelectRecent}
        {...props}
      />
    );
  }
);
AddressInput.displayName = 'AddressInput';

export { AddressInput, AddressInputBase };
