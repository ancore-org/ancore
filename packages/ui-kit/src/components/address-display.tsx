import * as React from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';

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
}

/**
 * AddressDisplay - A component for displaying blockchain addresses
 * Features truncation, copy-to-clipboard functionality, and responsive design
 */
const AddressDisplay = React.forwardRef<HTMLDivElement, AddressDisplayProps>(
  ({ address, copyable = true, truncate = 6, label, className, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const displayAddress = React.useMemo(() => {
      if (truncate && address.length > truncate * 2) {
        return `${address.slice(0, truncate)}...${address.slice(-truncate)}`;
      }
      return address;
    }, [address, truncate]);

    const handleCopy = React.useCallback(async () => {
      try {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    }, [address]);

    return (
      <div ref={ref} className={cn('space-y-1', className)} {...props}>
        {label && (
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <code className="flex-1 text-sm font-mono text-foreground break-all">
            {displayAddress}
          </code>
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
              aria-label="Copy address"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    );
  }
);
AddressDisplay.displayName = 'AddressDisplay';

export { AddressDisplay };
