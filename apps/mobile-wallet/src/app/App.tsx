import { useEffect, useState } from 'react';
import { ReadOnlyAccountView } from '../accounts';
import { useAppGate } from '../config/hooks/useAppGate';
import { MobileWalletShell } from '../navigation';
import { ForceUpdateScreen } from '../screens/gate/ForceUpdateScreen';
import { MaintenanceScreen } from '../screens/gate/MaintenanceScreen';
import { bootstrapMobileWallet } from './bootstrap';
import { isDeviceCompromised } from '../security/jailbreak';
import { JailbreakWarningScreen } from '../screens/JailbreakWarningScreen';

interface Props {
  env: Record<string, string | undefined>;
}

export const MobileWalletApp = ({ env }: Props) => {
  const [isCompromised, setIsCompromised] = useState(false);
  const [warningBypassed, setWarningBypassed] = useState(false);

  useEffect(() => {
    setIsCompromised(isDeviceCompromised());
  }, []);

  const bootstrap = bootstrapMobileWallet(env);
  const gate = useAppGate({
    configUrl: bootstrap.environment.remoteConfigUrl,
    appVersion: bootstrap.environment.appVersion,
    bypass: bootstrap.environment.remoteConfigBypass,
  });

  // Security gate takes priority over every other screen: a jailbroken or rooted
  // device can read the keychain, so the wallet must not render on one.
  // JailbreakWarningScreen only surfaces the bypass control under __DEV__.
  if (isCompromised && !warningBypassed) {
    return <JailbreakWarningScreen onContinueAnyway={() => setWarningBypassed(true)} />;
  }

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
