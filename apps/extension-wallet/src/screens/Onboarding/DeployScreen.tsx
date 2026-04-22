import * as React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Rocket, Key, Globe, Wallet } from 'lucide-react';

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
      return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-600" />;
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
}: DeployScreenProps) {
  const isDeploying = status === 'deploying' || status === 'funding' || status === 'initializing';
  const isSuccess = status === 'success';
  const hasError = status === 'error' || error;

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
    <div className="flex flex-col min-h-screen bg-background">
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
        <div className="flex justify-center mb-8">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center ${
              isSuccess ? 'bg-green-100' : hasError ? 'bg-red-100' : 'bg-primary/10'
            }`}
          >
            {getStatusIcon(status) || <Rocket className="w-10 h-10 text-primary" />}
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
                      ? 'bg-green-50 border border-green-200'
                      : isCurrent
                        ? 'bg-primary/5 border border-primary/20'
                        : 'bg-muted/30'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isComplete ? 'bg-green-100' : isCurrent ? 'bg-primary/10' : 'bg-muted/50'
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
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
                          ? 'text-green-700'
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
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl max-w-sm mx-auto">
            <p className="text-sm text-red-700 text-center">{error}</p>
          </div>
        )}

        {/* Success Details */}
        {isSuccess && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl max-w-sm mx-auto">
            <p className="text-sm text-green-700 text-center">
              Your smart wallet is now ready to use on Stellar testnet!
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8 bg-background border-t border-border/50">
        {!isDeploying && (
          <div className="space-y-3">
            {isSuccess ? (
              <button
                onClick={onComplete}
                className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98]"
              >
                Open Your Wallet
              </button>
            ) : hasError ? (
              <>
                <button
                  onClick={onRetry}
                  className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98]"
                >
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
              <button
                onClick={onComplete}
                disabled={isLoading}
                className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:shadow-none active:scale-[0.98]"
              >
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
