import { ReadOnlyAccountView } from '../accounts';
import { useAppGate } from '../config/hooks/useAppGate';
import { MobileWalletShell } from '../navigation';
import { ForceUpdateScreen } from '../screens/gate/ForceUpdateScreen';
import { MaintenanceScreen } from '../screens/gate/MaintenanceScreen';
import { bootstrapMobileWallet } from './bootstrap';

interface Props {
  env: Record<string, string | undefined>;
}

export const MobileWalletApp = ({ env }: Props) => {
  const bootstrap = bootstrapMobileWallet(env);
  const gate = useAppGate({
    configUrl: bootstrap.environment.remoteConfigUrl,
    appVersion: bootstrap.environment.appVersion,
    bypass: bootstrap.environment.remoteConfigBypass,
  });

  if (gate.isLoading) {
    return <p aria-live="polite">Loading…</p>;
  }

  if (gate.result.status === 'maintenance') {
    return <MaintenanceScreen message={gate.result.message} />;
  }

  if (gate.result.status === 'force-update') {
    return (
      <ForceUpdateScreen
        minimumAppVersion={gate.result.minimumAppVersion}
        currentVersion={bootstrap.environment.appVersion}
        updateUrl={gate.result.updateUrl}
      />
    );
  }

  return (
    <MobileWalletShell
      appName={bootstrap.environment.appName}
      activeRoute="account"
      network={bootstrap.environment.network}
    >
      <ReadOnlyAccountView
        account={bootstrap.account}
        accountContractId={bootstrap.sdk.accountContractId}
      />
    </MobileWalletShell>
  );
};
