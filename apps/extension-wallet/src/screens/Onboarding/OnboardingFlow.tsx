import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Download } from 'lucide-react';
import { validateMnemonicStrength, MnemonicValidationError } from '@ancore/crypto';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useExtensionAuth } from '@/router/AuthGuard';
import { WelcomeScreen } from './WelcomeScreen';
import { MnemonicScreen } from './MnemonicScreen';
import { VerifyMnemonicScreen } from './VerifyMnemonicScreen';
import { PasswordScreen } from './PasswordScreen';
import { DeployScreen } from './DeployScreen';
import { SuccessScreen } from './SuccessScreen';

type FlowMode = 'create' | 'import';

/**
 * Simple import screen — collects mnemonic + password then hands off to deploy.
 */
function WalletImportScreen({
  onSubmit,
  onBack,
}: {
  onSubmit: (mnemonic: string, password: string) => void;
  onBack: () => void;
}) {
  const [mnemonic, setMnemonic] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate mnemonic using the BIP39 strength validator before encrypting
    try {
      validateMnemonicStrength(mnemonic);
    } catch (err) {
      if (err instanceof MnemonicValidationError) {
        setError(err.message);
      } else {
        setError('Invalid recovery phrase. Please check your input.');
      }
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    onSubmit(mnemonic.trim(), password);
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="px-6 pt-6 pb-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Download className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Import Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Enter your 12 or 24-word recovery phrase to restore your wallet.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Recovery Phrase</label>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="Enter your recovery phrase words separated by spaces"
              rows={4}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none font-mono text-sm"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password for this wallet"
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>
      </div>

      <div className="px-6 py-6 pb-8 bg-background border-t border-border/50">
        <button
          onClick={handleSubmit as unknown as React.MouseEventHandler}
          disabled={!mnemonic.trim() || !password || !confirmPassword}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:shadow-none active:scale-[0.98]"
        >
          Import Wallet
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * OnboardingFlow — wires the real vault-backed onboarding through useOnboarding().
 *
 * Replaces the demo CreateAccountScreen. Route: /onboarding/* (also /welcome redirect).
 * Steps: welcome → generate → verify → password → deploy → success
 * Import path: welcome → import → password → deploy → success
 */
export function OnboardingFlow() {
  const navigate = useNavigate();
  const { completeOnboarding } = useExtensionAuth();
  const [flowMode, setFlowMode] = React.useState<FlowMode>('create');
  const [deployStatus, setDeployStatus] = React.useState<
    'idle' | 'deploying' | 'funding' | 'initializing' | 'success' | 'error'
  >('idle');

  const {
    step,
    mnemonic,
    account,
    error,
    isLoading,
    goToStep,
    goToPreviousStep,
    generateMnemonic,
    verifyMnemonic,
    setPassword,
    checkPasswordStrength,
    deployAccount,
    setMnemonicForImport,
    clearError,
  } = useOnboarding();

  // Generate mnemonic when entering the generate step
  const handleStartCreate = React.useCallback(async () => {
    setFlowMode('create');
    await generateMnemonic();
  }, [generateMnemonic]);

  const handleStartImport = React.useCallback(() => {
    setFlowMode('import');
    goToStep('password');
  }, [goToStep]);

  const handleImportSubmit = React.useCallback(
    (importedMnemonic: string, password: string) => {
      setMnemonicForImport(importedMnemonic);
      setPassword(password);
      goToStep('deploy');
    },
    [setMnemonicForImport, setPassword, goToStep]
  );

  const handleMnemonicNext = React.useCallback(() => {
    verifyMnemonic();
    goToStep('verify');
  }, [verifyMnemonic, goToStep]);

  const handlePasswordSubmit = React.useCallback(
    (password: string) => {
      setPassword(password);
      goToStep('deploy');
    },
    [setPassword, goToStep]
  );

  const handleDeploy = React.useCallback(async () => {
    setDeployStatus('funding');
    const result = await deployAccount('testnet');
    if (result) {
      setDeployStatus('success');
    } else {
      setDeployStatus('error');
    }
  }, [deployAccount]);

  // Retry deployment WITHOUT discarding the mnemonic/password the user already
  // provided. Clears the error and re-runs the deploy step.
  const handleDeployRetry = React.useCallback(() => {
    clearError();
    setDeployStatus('idle');
  }, [clearError]);

  const handleComplete = React.useCallback(() => {
    if (!account) return;
    completeOnboarding('Ancore Wallet', account.publicKey, account.contractId);
    navigate('/home', { replace: true });
  }, [account, completeOnboarding, navigate]);

  // Kick off deploy automatically when entering the deploy step
  React.useEffect(() => {
    if (step === 'deploy' && deployStatus === 'idle' && !isLoading) {
      void handleDeploy();
    }
  }, [step, deployStatus, isLoading, handleDeploy]);

  if (step === 'welcome') {
    return <WelcomeScreen onNext={handleStartCreate} onBack={undefined} />;
  }

  // Import path — shown before password step when flowMode is 'import'
  if (flowMode === 'import' && step === 'password') {
    return (
      <WalletImportScreen
        onSubmit={handleImportSubmit}
        onBack={() => {
          setFlowMode('create');
          goToStep('welcome');
        }}
      />
    );
  }

  if (step === 'generate' && mnemonic) {
    return (
      <MnemonicScreen mnemonic={mnemonic} onNext={handleMnemonicNext} onBack={goToPreviousStep} />
    );
  }

  if (step === 'verify' && mnemonic) {
    return (
      <VerifyMnemonicScreen
        mnemonic={mnemonic}
        onSuccess={() => goToStep('password')}
        onBack={goToPreviousStep}
      />
    );
  }

  if (step === 'password') {
    return (
      <PasswordScreen
        onSubmit={handlePasswordSubmit}
        onBack={goToPreviousStep}
        checkStrength={checkPasswordStrength}
      />
    );
  }

  if (step === 'deploy') {
    return (
      <DeployScreen
        isLoading={isLoading}
        error={error}
        status={deployStatus}
        txHash={account?.txHash}
        alreadyDeployed={account?.alreadyDeployed}
        onComplete={handleComplete}
        onRetry={handleDeployRetry}
        onBack={goToPreviousStep}
      />
    );
  }

  if (step === 'success' && account) {
    return (
      <SuccessScreen
        publicKey={account.publicKey}
        contractId={account.contractId}
        onComplete={handleComplete}
      />
    );
  }

  // Fallback while loading (e.g. generateMnemonic in flight)
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Setting up your wallet…</p>
      </div>
    </div>
  );
}

// Re-export the flow as the default named export used by older imports
export { OnboardingFlow as default };
