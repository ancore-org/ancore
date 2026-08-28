import * as React from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Rocket,
  Key,
  Globe,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { getTransactionExplorerLink } from '@/utils/explorer-links';

/**
 * DeployScreen props
 */
export interface DeployScreenProps {
  onComplete: () => void;
  onRetry: () => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string | null;
  status?: 'idle' | 'deploying' | 'funding' | 'initializing' | 'success' | 'error' | 'ready';
  /** Deployment transaction hash, surfaced once the contract is deployed. */
  txHash?: string;
  /** True when the contract already existed on-chain (reimport path). */
  alreadyDeployed?: boolean;
}

/**
 * Deployment steps
 */
const DEPLOYMENT_STEPS = [
  {
    id: 'funding',
    label: 'Funding account',
    description: 'Adding XLM to your account via Friendbot',
    icon: Globe,
  },
  {
    id: 'initializing',
    label: 'Initializing contract',
    description: 'Deploying your smart account contract',
    icon: Key,
  },
  {
    id: 'ready',
    label: 'Account ready',
    description: 'Your wallet is fully set up',
    icon: Wallet,
  },
];

/**
 * Get status icon
 */
function getStatusIcon(status: DeployScreenProps['status']) {
  switch (status) {
    case 'deploying':
    case 'funding':
    case 'initializing':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    case 'error':
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    default:
      return null;
  }
}

/**
 * DeployScreen - Deploys the account contract to Stellar
 *
 * Shows the deployment progress with loading states and
 * handles blockchain operations.
 */
export function DeployScreen({
  onComplete,
  onRetry,
  onBack,
  isLoading = false,
  error = null,
  status = 'idle',
  txHash,
  alreadyDeployed = false,
}: DeployScreenProps) {
  const isDeploying = status === 'deploying' || status === 'funding' || status === 'initializing';
  const isSuccess = status === 'success';
  const hasError = status === 'error' || error;
  const explorerLink = txHash ? getTransactionExplorerLink(txHash, 'testnet') : null;

  // Determine which steps are complete
  const completedSteps = React.useMemo(() => {
    const steps: string[] = [];
    if (isSuccess || status === 'ready') {
      steps.push('funding', 'initializing', 'ready');
    } else if (status === 'initializing') {
      steps.push('funding');
    } else if (status === 'funding') {
      // No steps complete yet
    }
    return steps;
  }, [status, isSuccess]);

  return (
    <div className="wallet-sheet">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        {!isDeploying && !isSuccess && !hasError && (
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-6 flex flex-col justify-center">
        {/* Status Icon */}
        <div className="mb-6 flex justify-center">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              isSuccess ? 'bg-success/10' : hasError ? 'bg-destructive/10' : 'bg-accent'
            }`}
          >
            {getStatusIcon(status) || <Rocket className="h-5 w-5 text-foreground" />}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-foreground mb-2">
            {isDeploying
              ? 'Creating Your Wallet'
              : isSuccess
                ? 'Wallet Created!'
                : hasError
                  ? 'Deployment Failed'
                  : 'Ready to Deploy'}
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            {isDeploying
              ? 'Please wait while we set up your smart wallet on the Stellar network...'
              : isSuccess
                ? 'Your wallet has been successfully created and is ready to use.'
                : hasError
                  ? 'Something went wrong during deployment. Please try again.'
                  : 'Click the button below to deploy your account contract to Stellar testnet.'}
          </p>
        </div>

        {/* Progress Steps */}
        {isDeploying && (
          <div className="space-y-4 max-w-sm mx-auto">
            {DEPLOYMENT_STEPS.map((step, index) => {
              const isComplete = completedSteps.includes(step.id);
              const isCurrent =
                !isComplete && !completedSteps.includes(DEPLOYMENT_STEPS[index - 1]?.id);

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isComplete
                      ? 'border border-success/20 bg-success/10'
                      : isCurrent
                        ? 'bg-primary/5 border border-primary/20'
                        : 'bg-muted/30'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isComplete ? 'bg-success/10' : isCurrent ? 'bg-accent' : 'bg-muted/50'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <step.icon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isComplete
                          ? 'text-foreground'
                          : isCurrent
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error Details */}
        {hasError && error && (
          <div className="wallet-status-error mx-auto mt-6 max-w-sm rounded-xl border p-4">
            <p className="text-center text-sm">{error}</p>
          </div>
        )}

        {/* Success Details */}
        {isSuccess && (
          <div className="wallet-status-success mx-auto mt-6 max-w-sm space-y-3 rounded-xl border p-4">
            <p className="text-center text-sm">
              {alreadyDeployed
                ? 'We found your existing smart account on Stellar testnet — no redeploy needed.'
                : 'Your smart wallet is now ready to use on Stellar testnet!'}
            </p>
            {explorerLink && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-success">
                  Transaction
                </p>
                <a
                  href={explorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-sm font-medium text-success underline underline-offset-2"
                >
                  <span className="font-mono">
                    {txHash!.slice(0, 8)}…{txHash!.slice(-8)}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8 bg-background border-t border-border/50">
        {!isDeploying && (
          <div className="space-y-3">
            {isSuccess ? (
              <button onClick={onComplete} className="wallet-pill-btn">
                Open Your Wallet
              </button>
            ) : hasError ? (
              <>
                <button onClick={onRetry} className="wallet-pill-btn">
                  Try Again
                </button>
                <button
                  onClick={onBack}
                  className="w-full py-3 px-6 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                >
                  Go Back
                </button>
              </>
            ) : (
              <button onClick={onComplete} disabled={isLoading} className="wallet-pill-btn">
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Deploy to Testnet
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Network Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Deploying to <span className="font-medium">Stellar Testnet</span>
          </p>
        </div>
      </div>
    </div>
  );
}
