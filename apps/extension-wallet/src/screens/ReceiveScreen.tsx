import * as React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  AddressDisplay,
  cn,
} from '@ancore/ui-kit';
import { ArrowLeft, Printer } from 'lucide-react';
import { PaymentQRCode } from '@/components/PaymentQRCode';
import type { StellarNetwork } from '@/utils/explorer-links';

export interface ReceiveScreenAccount {
  /** Stellar public key / address */
  publicKey: string;
  /** Human-readable account name or label (optional) */
  name?: string;
}

export interface ReceiveScreenProps {
  /** The account whose address should be displayed and encoded into the QR code */
  account: ReceiveScreenAccount;
  /** Active network – shown as a badge in the UI */
  network?: StellarNetwork;
  /** Called when the user taps/clicks the back arrow */
  onBack?: () => void;
  className?: string;
}

const NETWORK_LABEL: Record<StellarNetwork, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  futurenet: 'Futurenet',
};

const NETWORK_BADGE_CLASS: Record<StellarNetwork, string> = {
  mainnet:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  testnet:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  futurenet:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300',
};

/**
 * ReceiveScreen – wallet receive screen showing a QR code and copyable address.
 *
 * Usage:
 * ```tsx
 * <ReceiveScreen
 *   account={{ publicKey: 'GABC...123', name: 'My Wallet' }}
 *   network="testnet"
 *   onBack={() => navigate(-1)}
 * />
 * ```
 */
export function ReceiveScreen({
  account,
  network = 'mainnet',
  onBack,
  className,
}: ReceiveScreenProps) {
  const handlePrint = React.useCallback(() => {
    window.print();
  }, []);

  return (
    <Card className={cn('mx-auto w-full max-w-md border-slate-200', className)}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <CardHeader className="space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" aria-label="Go back" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <CardTitle className="text-lg">Receive</CardTitle>

          <div className="ml-auto">
            <Badge
              variant="outline"
              className={cn(
                'rounded-full px-3 py-0.5 text-xs font-medium',
                NETWORK_BADGE_CLASS[network]
              )}
              aria-label={`Network: ${NETWORK_LABEL[network]}`}
            >
              {NETWORK_LABEL[network]}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <CardContent className="flex flex-col items-center gap-6 pb-8">
        {/* QR Code */}
        <PaymentQRCode
          value={account.publicKey}
          size={220}
          aria-label={`QR code for ${account.name ?? 'your address'}`}
        />

        {/* Address + copy */}
        <div className="w-full space-y-2">
          {account.name && (
            <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-400">
              {account.name}
            </p>
          )}
          <AddressDisplay address={account.publicKey} copyable truncate={8} label="Your address" />
        </div>

        {/* Print button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handlePrint}
          aria-label="Print QR code"
        >
          <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
          Print QR Code
        </Button>
      </CardContent>
    </Card>
  );
}
