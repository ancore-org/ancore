import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import { DeployScreen } from './DeployScreen';

/**
 * DeployTestScreen — dev-only harness for exercising smart-account deployment
 * (issue #768) without completing the full onboarding router. Mounted only at
 * `/deploy-test` behind `import.meta.env.DEV`, so it is excluded from the
 * production build. Real router wiring lands with/after #764.
 */
export function DeployTestScreen() {
  const navigate = useNavigate();
  const {
    account,
    error,
    isLoading,
    mnemonic,
    setPassword,
    setMnemonicForImport,
    deployAccount,
    clearError,
  } = useOnboarding();

  const [status, setStatus] = React.useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [seeded, setSeeded] = React.useState(false);

  // Seed a throwaway mnemonic + password so the deploy step is reachable
  // standalone. This is a dev test fixture only.
  const handleSeed = React.useCallback(() => {
    setMnemonicForImport(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );
    setPassword('DevTestPass123!');
    setSeeded(true);
  }, [setMnemonicForImport, setPassword]);

  const handleDeploy = React.useCallback(async () => {
    setStatus('deploying');
    const result = await deployAccount('testnet');
    setStatus(result ? 'success' : 'error');
  }, [deployAccount]);

  // Kick off the deploy once seeded.
  React.useEffect(() => {
    if (seeded && mnemonic && status === 'idle' && !isLoading) {
      void handleDeploy();
    }
  }, [seeded, mnemonic, status, isLoading, handleDeploy]);

  if (!seeded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-lg font-bold text-foreground">Deploy test (dev only)</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Standalone harness for the smart-account deploy flow. Seeds a throwaway mnemonic, then
          runs the real deploy client against testnet.
        </p>
        <button
          onClick={handleSeed}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Run deploy flow
        </button>
      </div>
    );
  }

  return (
    <DeployScreen
      isLoading={isLoading}
      error={error}
      status={status}
      txHash={account?.txHash}
      alreadyDeployed={account?.alreadyDeployed}
      onComplete={() => navigate('/onboarding', { replace: true })}
      onRetry={() => {
        clearError();
        setStatus('idle');
      }}
      onBack={() => navigate('/onboarding', { replace: true })}
    />
  );
}

export default DeployTestScreen;
