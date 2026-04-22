import * as React from 'react';
import { Copy, Check, ExternalLink, Wallet, Sparkles, Shield, Zap } from 'lucide-react';

/**
 * SuccessScreen props
 */
export interface SuccessScreenProps {
  publicKey: string;
  contractId?: string;
  onComplete: () => void;
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Copy address to clipboard
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * SuccessScreen - Shows successful account creation
 *
 * Displays the newly created account details and provides
 * options to copy addresses and access the wallet.
 */
export function SuccessScreen({ publicKey, contractId, onComplete }: SuccessScreenProps) {
  const [copiedPublicKey, setCopiedPublicKey] = React.useState(false);
  const [copiedContractId, setCopiedContractId] = React.useState(false);

  const handleCopyPublicKey = React.useCallback(async () => {
    const success = await copyToClipboard(publicKey);
    if (success) {
      setCopiedPublicKey(true);
      setTimeout(() => setCopiedPublicKey(false), 2000);
    }
  }, [publicKey]);

  const handleCopyContractId = React.useCallback(async () => {
    if (!contractId) return;
    const success = await copyToClipboard(contractId);
    if (success) {
      setCopiedContractId(true);
      setTimeout(() => setCopiedContractId(false), 2000);
    }
  }, [contractId]);

  const openExplorer = React.useCallback(() => {
    const url = `https://stellar.expert/explorer/testnet/account/${publicKey}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [publicKey]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-green-50/50 via-background to-background">
      {/* Content */}
      <div className="flex-1 px-6 flex flex-col justify-center py-8">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-green-400 border-4 border-background flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Congratulations!</h1>
          <p className="text-sm text-muted-foreground">
            Your Ancore wallet has been created successfully
          </p>
        </div>

        {/* Account Card */}
        <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Your Wallet</p>
              <p className="text-xs text-muted-foreground">Stellar Testnet</p>
            </div>
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Public Key
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2.5 font-mono text-sm text-foreground truncate">
                {truncateAddress(publicKey, 12)}
              </div>
              <button
                onClick={handleCopyPublicKey}
                className="flex-shrink-0 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                {copiedPublicKey ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Contract ID (if available) */}
          {contractId && (
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Contract ID
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2.5 font-mono text-sm text-foreground truncate">
                  {truncateAddress(contractId, 12)}
                </div>
                <button
                  onClick={handleCopyContractId}
                  className="flex-shrink-0 p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                >
                  {copiedContractId ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <Shield className="w-5 h-5 text-green-600 mb-2" />
            <p className="text-sm font-medium text-foreground">Secured</p>
            <p className="text-xs text-muted-foreground">Your keys are encrypted</p>
          </div>
          <div className="bg-card rounded-xl border border-border/50 p-4">
            <Zap className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">Ready</p>
            <p className="text-xs text-muted-foreground">Testnet activated</p>
          </div>
        </div>

        {/* View on Explorer */}
        <button
          onClick={openExplorer}
          className="w-full py-3 px-4 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          View on Stellar Expert
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8">
        <button
          onClick={onComplete}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98]"
        >
          <Wallet className="w-5 h-5" />
          Open Wallet
        </button>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Remember: Your recovery phrase is the ONLY way to restore your wallet. Keep it safe and
          never share it.
        </p>
      </div>
    </div>
  );
}
