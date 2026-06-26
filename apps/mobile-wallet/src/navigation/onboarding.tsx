import { useCallback, useContext, createContext, useMemo, useReducer } from 'react';
import { importWallet, type WalletMaterial } from '@ancore/core-sdk';
import { generateMnemonic } from '@ancore/crypto';
import type { Network } from '@ancore/types';

import { createHdAccountDiscovery } from '../onboarding/hd-account-discovery';
import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingFlow,
  type OnboardingRoute,
  type OnboardingState,
} from '../screens/onboarding';
import { OnboardingCompleteScreen } from '../screens/onboarding/OnboardingCompleteScreen';
import { OnboardingEntryScreen } from '../screens/onboarding/OnboardingEntryScreen';
import { WalletCreateScreen } from '../screens/onboarding/WalletCreateScreen';
import {
  WalletImportScreen,
  type DiscoverAccountsFn,
} from '../screens/onboarding/WalletImportScreen';
import { WalletRecoverScreen } from '../screens/onboarding/WalletRecoverScreen';
import { MnemonicDisplayScreen } from '../screens/onboarding/MnemonicDisplayScreen';
import { VerifyMnemonicScreen } from '../screens/onboarding/VerifyMnemonicScreen';
import { PasswordScreen } from '../screens/onboarding/PasswordScreen';
import type { MobileSecureVault } from '../security/mobile-secure-vault';

type OnboardingAction =
  | { type: 'start'; flow: OnboardingFlow }
  | { type: 'goTo'; route: OnboardingRoute }
  | { type: 'back' }
  | { type: 'cancel' }
  | { type: 'complete' }
  | { type: 'restart' }
  | { type: 'setMnemonic'; mnemonic: string }
  | { type: 'setPassword'; password: string }
  | { type: 'setAccountIndex'; accountIndex: number }
  | { type: 'clearSensitiveData' };

type OnboardingContextValue = {
  state: OnboardingState;
  startCreate: () => void;
  startImport: () => void;
  startRecover: () => void;
  back: () => void;
  cancel: () => void;
  complete: () => void;
  restart: () => void;
  goTo: (route: OnboardingRoute) => void;
  setMnemonic: (mnemonic: string) => void;
  setPassword: (password: string) => void;
  setAccountIndex: (accountIndex: number) => void;
  clearSensitiveData: () => void;
};

export type PersistImportedWalletInput = {
  wallet: WalletMaterial;
  password: string;
  network: Network;
};

export type OnboardingNavigatorProps = {
  initialState?: Partial<OnboardingState>;
  vault?: MobileSecureVault;
  network?: Network;
  discoverAccounts?: DiscoverAccountsFn;
  onPersistWallet?: (input: PersistImportedWalletInput) => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function sanitizeInitialState(initialState?: Partial<OnboardingState>): OnboardingState {
  if (!initialState || initialState.route === undefined) {
    return DEFAULT_ONBOARDING_STATE;
  }

  if (initialState.route === 'entry') {
    return DEFAULT_ONBOARDING_STATE;
  }

  if (
    initialState.route === 'complete' &&
    (initialState.flow === 'create' ||
      initialState.flow === 'import' ||
      initialState.flow === 'recover')
  ) {
    return {
      ...DEFAULT_ONBOARDING_STATE,
      route: 'complete',
      flow: initialState.flow,
      history: ['entry', initialState.flow, 'complete'],
    };
  }

  const VALID_ROUTES: OnboardingRoute[] = [
    'create',
    'create-display',
    'create-verify',
    'create-password',
    'import',
    'import-password',
    'recover',
  ];

  if (
    VALID_ROUTES.includes(initialState.route) &&
    initialState.flow === initialState.route.split('-')[0]
  ) {
    return {
      ...DEFAULT_ONBOARDING_STATE,
      route: initialState.route,
      flow: initialState.flow,
      history: ['entry', ...(initialState.history?.slice(1) ?? [initialState.route])],
      accountIndex: initialState.accountIndex ?? null,
    };
  }

  return DEFAULT_ONBOARDING_STATE;
}

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        route: action.flow,
        flow: action.flow,
        history: ['entry', action.flow],
        mnemonic: null,
        password: null,
        accountIndex: null,
      };
    case 'goTo':
      return {
        ...state,
        route: action.route,
        history: [...state.history, action.route],
      };
    case 'back': {
      if (state.history.length <= 1) {
        return DEFAULT_ONBOARDING_STATE;
      }

      const history = state.history.slice(0, -1);
      const route = history[history.length - 1] ?? 'entry';

      if (route === 'entry') {
        return DEFAULT_ONBOARDING_STATE;
      }

      return {
        ...state,
        route,
        history,
      };
    }
    case 'cancel':
      return DEFAULT_ONBOARDING_STATE;
    case 'complete':
      if (state.route === 'entry') {
        return state;
      }

      return {
        ...state,
        route: 'complete',
        history: [...state.history, 'complete'],
      };
    case 'restart':
      return DEFAULT_ONBOARDING_STATE;
    case 'setMnemonic':
      return { ...state, mnemonic: action.mnemonic };
    case 'setPassword':
      return { ...state, password: action.password };
    case 'setAccountIndex':
      return { ...state, accountIndex: action.accountIndex };
    case 'clearSensitiveData':
      return { ...state, mnemonic: null, password: null, accountIndex: null };
    default:
      return state;
  }
}

function useOnboardingNavigator(initialState?: Partial<OnboardingState>) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState, sanitizeInitialState);

  return useMemo<OnboardingContextValue>(
    () => ({
      state,
      startCreate: () => dispatch({ type: 'start', flow: 'create' }),
      startImport: () => dispatch({ type: 'start', flow: 'import' }),
      startRecover: () => dispatch({ type: 'start', flow: 'recover' }),
      back: () => dispatch({ type: 'back' }),
      cancel: () => dispatch({ type: 'cancel' }),
      complete: () => dispatch({ type: 'complete' }),
      restart: () => dispatch({ type: 'restart' }),
      goTo: (route) => dispatch({ type: 'goTo', route }),
      setMnemonic: (mnemonic) => dispatch({ type: 'setMnemonic', mnemonic }),
      setPassword: (password) => dispatch({ type: 'setPassword', password }),
      setAccountIndex: (accountIndex) => dispatch({ type: 'setAccountIndex', accountIndex }),
      clearSensitiveData: () => dispatch({ type: 'clearSensitiveData' }),
    }),
    [state]
  );
}

function useOnboardingContext(): OnboardingContextValue {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error('OnboardingNavigator must be used within OnboardingNavigatorProvider');
  }

  return context;
}

async function persistWalletToVault(
  vault: MobileSecureVault,
  wallet: WalletMaterial,
  password: string,
  network: Network
): Promise<void> {
  await vault.unlock(password);
  await vault.persistAccount({
    id: wallet.publicKey,
    address: wallet.publicKey,
    label: 'Imported Account',
    keyMaterial: wallet.secretKey,
    accountPayload: {
      accountIndex: wallet.accountIndex,
      contractId: wallet.contractId,
      encryptedMnemonic: wallet.encryptedMnemonic,
      network,
    },
  });
}

function OnboardingRouteView({
  vault,
  network,
  discoverAccounts,
  onPersistWallet,
}: Required<Pick<OnboardingNavigatorProps, 'network'>> &
  Pick<OnboardingNavigatorProps, 'vault' | 'discoverAccounts' | 'onPersistWallet'>) {
  const {
    state,
    startCreate,
    startImport,
    startRecover,
    back,
    cancel,
    complete,
    restart,
    goTo,
    setMnemonic,
    setAccountIndex,
    clearSensitiveData,
  } = useOnboardingContext();

  const handleCreateContinue = useCallback(() => {
    const mnemonic = generateMnemonic();
    setMnemonic(mnemonic);
    goTo('create-display');
  }, [setMnemonic, goTo]);

  const handleImportContinue = useCallback(
    (mnemonic: string, accountIndex: number) => {
      setMnemonic(mnemonic);
      setAccountIndex(accountIndex);
      goTo('import-password');
    },
    [setMnemonic, setAccountIndex, goTo]
  );

  const persistWallet = useCallback(
    async (password: string, accountIndex: number) => {
      const wallet = await importWallet({
        mnemonic: state.mnemonic!,
        password,
        accountIndex,
      });

      if (onPersistWallet) {
        await onPersistWallet({ wallet, password, network });
      } else if (vault) {
        await persistWalletToVault(vault, wallet, password, network);
      }

      return wallet;
    },
    [network, onPersistWallet, state.mnemonic, vault]
  );

  const handleCreatePasswordComplete = useCallback(
    async (password: string) => {
      await persistWallet(password, 0);
      clearSensitiveData();
      complete();
    },
    [clearSensitiveData, complete, persistWallet]
  );

  const handleImportPasswordComplete = useCallback(
    async (password: string) => {
      await persistWallet(password, state.accountIndex ?? 0);
      clearSensitiveData();
      complete();
    },
    [clearSensitiveData, complete, persistWallet, state.accountIndex]
  );

  switch (state.route) {
    case 'entry':
      return (
        <OnboardingEntryScreen
          onCreate={startCreate}
          onImport={startImport}
          onRecover={startRecover}
        />
      );
    case 'create':
      return (
        <WalletCreateScreen onBack={back} onCancel={cancel} onContinue={handleCreateContinue} />
      );
    case 'create-display':
      return (
        <MnemonicDisplayScreen
          mnemonic={state.mnemonic ?? ''}
          onBack={back}
          onCancel={cancel}
          onContinue={() => goTo('create-verify')}
        />
      );
    case 'create-verify':
      return (
        <VerifyMnemonicScreen
          mnemonic={state.mnemonic ?? ''}
          onBack={back}
          onCancel={cancel}
          onComplete={() => goTo('create-password')}
        />
      );
    case 'create-password':
      return (
        <PasswordScreen
          flow="create"
          onBack={back}
          onCancel={cancel}
          onComplete={handleCreatePasswordComplete}
        />
      );
    case 'import':
      return (
        <WalletImportScreen
          discoverAccounts={discoverAccounts}
          onBack={back}
          onCancel={cancel}
          onContinue={handleImportContinue}
        />
      );
    case 'import-password':
      return (
        <PasswordScreen
          flow="import"
          onBack={back}
          onCancel={cancel}
          onComplete={handleImportPasswordComplete}
        />
      );
    case 'recover':
      return <WalletRecoverScreen onBack={back} onCancel={cancel} onContinue={complete} />;
    case 'complete':
      return <OnboardingCompleteScreen onRestart={restart} />;
    default:
      return (
        <OnboardingEntryScreen
          onCreate={startCreate}
          onImport={startImport}
          onRecover={startRecover}
        />
      );
  }
}

export function OnboardingNavigator({
  initialState,
  vault,
  network = 'testnet',
  discoverAccounts = createHdAccountDiscovery(network),
  onPersistWallet,
}: OnboardingNavigatorProps = {}) {
  const contextValue = useOnboardingNavigator(initialState);

  return (
    <OnboardingContext.Provider value={contextValue}>
      <OnboardingRouteView
        discoverAccounts={discoverAccounts}
        network={network}
        onPersistWallet={onPersistWallet}
        vault={vault}
      />
    </OnboardingContext.Provider>
  );
}

export function OnboardingNavigatorTestHarness({
  initialState,
  vault,
  network,
  discoverAccounts,
  onPersistWallet,
}: OnboardingNavigatorProps = {}) {
  return (
    <OnboardingNavigator
      discoverAccounts={discoverAccounts}
      initialState={initialState}
      network={network}
      onPersistWallet={onPersistWallet}
      vault={vault}
    />
  );
}
