import { Copy, Check, Globe } from 'lucide-react';
import { Button } from '@ancore/ui-kit';
import { Badge, Tooltip } from '@ancore/ui-kit';

interface AccountHeaderProps {
  address: string;
  network: string;
  onCopyAddress: () => void;
  copied?: boolean;
}

export function AccountHeader({
  address,
  network,
  onCopyAddress,
  copied = false,
}: AccountHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-card/80 border border-border/50 shadow-lg p-6">
      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/5 rounded-full translate-y-12 -translate-x-12" />

      <div className="relative z-10">
        {/* Address Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-muted-foreground">Account Address</h2>
            <Tooltip
              content={
                network.toLowerCase() === 'mainnet'
                  ? 'Environment: Production (Horizon Mainnet)'
                  : network.toLowerCase() === 'staging'
                    ? 'Environment: Staging (Horizon Testnet)'
                    : 'Environment: Sandbox (Horizon Testnet)'
              }
            >
              <div tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded cursor-help">
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/5 text-primary font-medium"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  {network}
                </Badge>
              </div>
            </Tooltip>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xl font-bold tracking-wider truncate bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                {address}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Stellar Public Key • Ed25519</p>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={onCopyAddress}
              className="shrink-0 rounded-full border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 hover:scale-105"
              aria-label={copied ? 'Address copied' : 'Copy address'}
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Network Info */}
        <div className="pt-4 border-t border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${network === 'Mainnet' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}
              />
              <span className="text-sm font-medium">
                {network === 'Mainnet' ? 'Live Network' : 'Test Network'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {network === 'Mainnet' ? 'Real XLM' : 'Test XLM'}
            </div>
          </div>

          <div className="mt-2">
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${network === 'Mainnet' ? 'bg-green-500' : 'bg-yellow-500'} rounded-full`}
                style={{ width: '100%' }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Secure</span>
              <span>Connected</span>
              <span>Synced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountHeader;
