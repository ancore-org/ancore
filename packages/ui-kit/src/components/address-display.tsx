import * as React from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Identicon } from './Identicon';
import { Tooltip } from './ui/tooltip';

export interface AddressDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The address to display
   */
  address: string;
  /**
   * Whether to show the copy button
   */
  copyable?: boolean;
  /**
   * Number of characters to show at start and end when truncating
   */
  truncate?: number;
  /**
   * Optional label for the address
   */
  label?: string;
  /**
   * Custom copy handler (e.g. toast + telemetry). When set, internal clipboard logic is skipped.
   */
  onCopy?: () => void | Promise<void>;
  /**
   * Controlled copied state when using onCopy
   */
  copied?: boolean;
  /**
   * Whether to show an identicon avatar derived from the address
   */
  showIdenticon?: boolean;
  /**
   * Whether the address is valid. When explicitly set to false, renders a red error ring
   * and an alert icon. When undefined (default), no validation indicator is shown.
   */
  isValid?: boolean;
  /**
   * Optional callback for copy errors
   */
  onCopyError?: (error: Error) => void;
}

/**
 * AddressDisplay - A component for displaying blockchain addresses.
 *
 * Features:
 * - Truncation (configurable characters at each end)
 * - Copy-to-clipboard with confirmation state
 * - Full-address tooltip on hover / focus-within
 * - Optional deterministic identicon avatar
 * - Address validation visual feedback (isValid prop)
 * - Fully accessible (labels, aria-live, keyboard navigable)
 */
const AddressDisplay = React.forwardRef<HTMLDivElement, AddressDisplayProps>(
  (
    {
      address,
      copyable = true,
      truncate = 6,
      label,
      onCopy,
      copied: copiedProp,
      showIdenticon = false,
      isValid,
      onCopyError,
      className,
      ...props
    },
    ref
  ) => {
    const [internalCopied, setInternalCopied] = React.useState(false);
    const copied = copiedProp ?? internalCopied;

    const displayAddress = React.useMemo(() => {
      if (truncate && address.length > truncate * 2) {
        return `${address.slice(0, truncate)}...${address.slice(-truncate)}`;
      }
      return address;
    }, [address, truncate]);

    const handleCopy = React.useCallback(async () => {
      if (onCopy) {
        await onCopy();
        return;
      }
      try {
        await navigator.clipboard.writeText(address);
        setInternalCopied(true);
        setTimeout(() => setInternalCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
        onCopyError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }, [address, onCopy, onCopyError]);

    // Derive border / ring class from validation state
    const borderClass =
      isValid === false ? 'border-destructive ring-1 ring-destructive' : 'border-input';

    return (
      <div ref={ref} className={cn('space-y-1', className)} {...props}>
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}

        <div
          className={cn(
            'flex items-center gap-2 rounded-md border bg-background px-3 py-2 transition-colors',
            borderClass
          )}
        >
          {/* Identicon avatar */}
          {showIdenticon && (
            <Identicon value={address} size={24} className="shrink-0" aria-hidden="true" />
          )}

          {/* Truncated address with full-address tooltip */}
          <Tooltip content={address}>
            <code
              className="flex-1 text-sm font-mono text-foreground break-all cursor-default"
              aria-label={`Address: ${address}`}
            >
              {displayAddress}
            </code>
          </Tooltip>

          {/* Validation error icon */}
          {isValid === false && (
            <AlertCircle
              className="h-4 w-4 shrink-0 text-destructive"
              aria-label="Invalid address"
            />
          )}

          {/* Copy button */}
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 shrink-0"
              aria-label={copied ? 'Copied!' : 'Copy address'}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* Live region announces copy success to screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {copied ? 'Address copied to clipboard' : ''}
        </div>
      </div>
    );
  }
);
AddressDisplay.displayName = 'AddressDisplay';

export { AddressDisplay };
