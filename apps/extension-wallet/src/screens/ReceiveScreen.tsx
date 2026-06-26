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
import { ArrowLeft, Download } from 'lucide-react';
import { PaymentQRCode } from '@/components/PaymentQRCode';
import downloadQrPng from '@/utils/export-qr';
import { useCopyWithFeedback } from '@/hooks/useCopyWithFeedback';
import type { Network } from '@ancore/types';

export interface ReceiveScreenProps {
  smartAccountId?: string | null;
  ownerPublicKey?: string | null;
  network?: Network;
  onBack?: () => void;
  className?: string;
}

const NETWORK_LABEL: Record<Network, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  futurenet: 'Futurenet',
  local: 'Local',
};

const NETWORK_BADGE_CLASS: Record<Network, string> = {
  mainnet:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  testnet:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  futurenet:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300',
  local:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300',
};

function buildPaymentUri(destination: string, network: Network): string {
  return `web+stellar:pay?destination=${encodeURIComponent(destination)}&network=${encodeURIComponent(network)}`;
}

function downloadSvgAsPng(svgElement: SVGSVGElement, filename: string) {
  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  const bounds = svgElement.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgClone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  };
  img.src = url;
}

export function ReceiveScreen({
  smartAccountId,
  ownerPublicKey,
  network = 'mainnet',
  onBack,
  className,
}: ReceiveScreenProps) {
  const { copy: copySmartId, copied: smartIdCopied } = useCopyWithFeedback();
  const { copy: copyPublicKey, copied: publicKeyCopied } = useCopyWithFeedback();
  const qrRef = React.useRef<SVGSVGElement>(null);
  const paymentUri = smartAccountId ? buildPaymentUri(smartAccountId, network) : '';

  const handleDownload = React.useCallback(async () => {
    if (!smartAccountId) return;
    try {
      await downloadQrPng(paymentUri, {
        filename: `ancore-receive-${smartAccountId.slice(0, 8)}.png`,
        scale: 3,
      });
    } catch {
      // Fallback to previous SVG -> PNG method if QR lib unavailable
      if (qrRef.current)
        downloadSvgAsPng(qrRef.current, `ancore-receive-${smartAccountId.slice(0, 8)}.png`);
    }
  }, [smartAccountId, paymentUri]);

  if (!smartAccountId) {
    return (
      <Card className={cn('mx-auto w-full max-w-md border-slate-200', className)}>
        <CardHeader className="space-y-0 pb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Go back"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <CardTitle className="text-lg">Receive</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pb-8 text-center">
          <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
            <Download className="h-8 w-8 text-slate-400" aria-hidden="true" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Complete onboarding to get your receive address
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('mx-auto w-full max-w-md border-slate-200', className)}>
      <CardHeader className="space-y-0 pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button type="button" variant="ghost" size="icon" aria-label="Go back" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
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

      <CardContent className="flex flex-col items-center gap-6 pb-8">
        <PaymentQRCode
          value={paymentUri}
          size={220}
          qrRef={qrRef}
          aria-label={`QR code for smart account ${smartAccountId}`}
        />

        <div className="w-full space-y-3">
          <AddressDisplay
            address={smartAccountId}
            copyable
            truncate={8}
            label="Contract ID"
            onCopy={() => void copySmartId(smartAccountId)}
            copied={smartIdCopied}
          />
          {ownerPublicKey && (
            <AddressDisplay
              address={ownerPublicKey}
              copyable
              truncate={8}
              label="Owner public key"
              onCopy={() => void copyPublicKey(ownerPublicKey)}
              copied={publicKeyCopied}
            />
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleDownload}
          aria-label="Download QR code as PNG"
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
}
