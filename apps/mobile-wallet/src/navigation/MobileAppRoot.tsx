import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReadOnlyAccountView } from '../accounts';
import { bootstrapMobileWallet } from '../app/bootstrap';
import { resolveMobileWalletEnv } from '../config/dev-defaults';
import { useAppGate } from '../config/hooks/useAppGate';
import { OnboardingNavigator } from './onboarding';
import { MobileWalletShell } from './MobileWalletShell';
import { WalletKitProvider } from '../providers/WalletKitProvider';
import { createStellarRpcHandlers } from '../providers/stellar-handlers';
import { createVaultSignService } from '../providers/mobile-sign-service';
import {
  BiometricLockoutManager,
  type ISecureStorage,
} from '../security/biometric-lockout-manager';
import {
  type IBiometricAuthService,
  type IPasswordAuthService,
} from '../security/hooks/useBiometricUnlock';
import {
  getSharedStorageManager,
  hasOnboardedWallet,
  unlockSharedStorageManager,
} from '../security/storage-manager';
import { getSigningKeypair } from '../security/signing-key';
import { createSecureStoreAdapter } from '../storage/secure-store-factory';
import { UnlockScreen } from '../screens/unlock/UnlockScreen';
import { ForceUpdateScreen } from '../screens/gate/ForceUpdateScreen';
import { MaintenanceScreen } from '../screens/gate/MaintenanceScreen';
import { JailbreakWarningScreen } from '../screens/JailbreakWarningScreen';
import { isDeviceCompromised } from '../security/jailbreak';
import { WalletConnectPanel } from '../screens/walletconnect/WalletConnectPanel';
import { buildStellarAccountId, networkToStellarChain } from '../walletconnect/constants';

type AppPhase = 'loading' | 'onboarding' | 'unlock' | 'main';
type MainRoute = 'account' | 'settings';
const unavailableBiometricService: IBiometricAuthService = {
  isAvailable: async () => false,
  authenticate: async () => ({ success: false, error: 'Biometrics unavailable' }),
};

function createLockoutStorage(): ISecureStorage {
  const store = createSecureStoreAdapter();
  return {
    getItem: (key) => store.get(key),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.remove(key),
  };
}

function SettingsPanel({ onLock }: { onLock: () => void }) {
  return (
    <section aria-label="Settings">
      <h2>Settings</h2>
      <button type="button" onClick={onLock}>
        Lock wallet
      </button>
    </section>
  );
}

export function MobileAppRoot({ env = {} }: { env?: Record<string, string | undefined> }) {
  const [phase, setPhase] = useState<AppPhase>('loading');
  const [mainRoute, setMainRoute] = useState<MainRoute>('account');
  const [activeAccount, setActiveAccount] = useState<string | undefined>();
  const [isCompromised, setIsCompromised] = useState(false);
  const [warningBypassed, setWarningBypassed] = useState(false);
  const bootstrap = useMemo(() => bootstrapMobileWallet(resolveMobileWalletEnv(env)), [env]);
  const gate = useAppGate({
    configUrl: bootstrap.environment.remoteConfigUrl,
    appVersion: bootstrap.environment.appVersion,
    bypass: bootstrap.environment.remoteConfigBypass,
  });
  const lockoutManager = useMemo(() => new BiometricLockoutManager(createLockoutStorage()), []);
  const activeChain = useMemo(
    () => networkToStellarChain(bootstrap.environment.network),
    [bootstrap.environment.network]
  );
  const refreshPhase = useCallback(async () => {
    const onboarded = await hasOnboardedWallet();
    setPhase(onboarded ? 'unlock' : 'onboarding');
  }, []);
  useEffect(() => {
    void refreshPhase();
  }, [refreshPhase]);
  useEffect(() => {
    setIsCompromised(isDeviceCompromised());
  }, []);
  useEffect(() => {
    if (phase !== 'main') {
      setActiveAccount(undefined);
      return;
    }
    void getSigningKeypair()
      .then((keypair) => {
        setActiveAccount(buildStellarAccountId(activeChain, keypair.publicKey()));
      })
      .catch(() => {
        setActiveAccount(undefined);
      });
  }, [phase, activeChain]);
  const passwordService = useMemo<IPasswordAuthService>(
    () => ({
      // Unlock through the shared helper, not `manager.unlock` directly: it
      // also runs the legacy-vault migration, which is the only thing that
      // gives an upgrading user access to accounts saved before the vault
      // unification (#1338).
      authenticate: async (password: string) => unlockSharedStorageManager(password),
    }),
    []
  );
  const handleLock = useCallback(() => {
    getSharedStorageManager().lock();
    setMainRoute('account');
    setPhase('unlock');
  }, []);
  const stellarHandlers = useMemo(
    () =>
      createStellarRpcHandlers(createVaultSignService({ network: bootstrap.environment.network })),
    [bootstrap.environment.network]
  );
  const walletConnectProjectId =
    bootstrap.environment.walletConnectProjectId ?? 'example-project-id';
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
  if (phase === 'loading') {
    return <p aria-live="polite">Loading…</p>;
  }
  if (phase === 'onboarding') {
    return <OnboardingNavigator onComplete={() => setPhase('unlock')} />;
  }
  if (phase === 'unlock') {
    return (
      <UnlockScreen
        lockoutManager={lockoutManager}
        biometricService={unavailableBiometricService}
        passwordService={passwordService}
        onUnlocked={() => setPhase('main')}
      />
    );
  }
  return (
    <WalletKitProvider
      projectId={walletConnectProjectId}
      stellarHandlers={stellarHandlers}
      metadata={{ name: bootstrap.environment.appName }}
      activeChain={activeChain}
      activeAccount={activeAccount}
    >
      <MobileWalletShell
        appName={bootstrap.environment.appName}
        activeRoute={mainRoute === 'settings' ? 'settings' : 'account'}
        network={bootstrap.environment.network}
        items={[
          { route: 'account', label: 'Account' },
          { route: 'settings', label: 'Settings' },
        ]}
        onNavigate={(route) => setMainRoute(route === 'settings' ? 'settings' : 'account')}
      >
        {mainRoute === 'settings' ? (
          <SettingsPanel onLock={handleLock} />
        ) : (
          <>
            <ReadOnlyAccountView
              account={bootstrap.account}
              accountContractId={bootstrap.sdk.accountContractId}
            />
            <WalletConnectPanel />
          </>
        )}
      </MobileWalletShell>
    </WalletKitProvider>
  );
}
