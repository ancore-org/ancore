import * as React from 'react';
import { Copy, Check, ExternalLink, Wallet, Shield, Zap } from 'lucide-react';
import { useCopyWithFeedback } from '@/hooks/useCopyWithFeedback';
import { truncateAddress } from '@/utils/address';

/**
 * SuccessScreen props
 */
export interface SuccessScreenProps {
  publicKey: string;
  contractId?: string;
  onComplete: () => void;
}

/**
 * SuccessScreen - Shows successful account creation
 *
 * Displays the newly created account details and provides
 * options to copy addresses and access the wallet.
 */
export function SuccessScreen({ publicKey, contractId, onComplete }: SuccessScreenProps) {
  const { copy, copied: copiedPublicKey } = useCopyWithFeedback();
  const { copy: copyContract, copied: copiedContractId } = useCopyWithFeedback();

  const handleCopyPublicKey = React.useCallback(async () => {
    await copy(publicKey);
  }, [publicKey, copy]);

  const handleCopyContractId = React.useCallback(async () => {
    if (!contractId) return;
    await copyContract(contractId);
  }, [contractId, copyContract]);

  const openExplorer = React.useCallback(() => {
    const url = `https://stellar.expert/explorer/testnet/account/${publicKey}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [publicKey]);

  return (
    <div className="wallet-sheet">
      {/* Content */}
      <div className="flex-1 px-6 flex flex-col justify-center py-8">
        {/* Success Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <Wallet className="h-6 w-6 text-success" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-success">
              <Check className="h-3 w-3 text-success-foreground" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
            Wallet ready
          </h1>
          <p className="text-sm text-muted-foreground">
            Your Ancore wallet has been created successfully
          </p>
        </div>

        {/* Account Card */}
        <div className="wallet-card mb-6 p-5">
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
            <Shield className="mb-2 h-5 w-5 text-success" />
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
        <button onClick={openExplorer} className="wallet-pill-btn-secondary h-12">
          View on Stellar Expert
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8">
        <button onClick={onComplete} className="wallet-pill-btn">
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
