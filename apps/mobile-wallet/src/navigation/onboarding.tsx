import { useCallback, useContext, createContext, useMemo, useReducer, useState } from 'react';
import { generateMnemonic } from '@ancore/crypto';

import { persistOnboardedWallet } from '../onboarding/persist-wallet';

import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingFlow,
  type OnboardingRoute,
  type OnboardingState,
} from '../screens/onboarding';
import { OnboardingCompleteScreen } from '../screens/onboarding/OnboardingCompleteScreen';
import { OnboardingEntryScreen } from '../screens/onboarding/OnboardingEntryScreen';
import { WalletCreateScreen } from '../screens/onboarding/WalletCreateScreen';
import { WalletImportScreen } from '../screens/onboarding/WalletImportScreen';
import { WalletRecoverScreen } from '../screens/onboarding/WalletRecoverScreen';
import { MnemonicDisplayScreen } from '../screens/onboarding/MnemonicDisplayScreen';
import { VerifyMnemonicScreen } from '../screens/onboarding/VerifyMnemonicScreen';
import { PasswordScreen } from '../screens/onboarding/PasswordScreen';

type OnboardingAction =
  | { type: 'start'; flow: OnboardingFlow }
  | { type: 'goTo'; route: OnboardingRoute }
  | { type: 'back' }
  | { type: 'cancel' }
  | { type: 'complete' }
  | { type: 'restart' }
  | { type: 'setMnemonic'; mnemonic: string }
  | { type: 'setPassword'; password: string }
  | { type: 'setWalletLabel'; walletLabel: string }
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
  setWalletLabel: (walletLabel: string) => void;
  clearSensitiveData: () => void;
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
        walletLabel: null,
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
    case 'setWalletLabel':
      return { ...state, walletLabel: action.walletLabel };
    case 'clearSensitiveData':
      return { ...state, mnemonic: null, password: null };
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
      setWalletLabel: (walletLabel) => dispatch({ type: 'setWalletLabel', walletLabel }),
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

function OnboardingRouteView({ onComplete }: { onComplete?: () => void }) {
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
    setWalletLabel,
    clearSensitiveData,
  } = useOnboardingContext();

  const [error, setError] = useState<string | null>(null);

  const persistWallet = useCallback(
    async (password: string) => {
      if (!state.mnemonic) {
        throw new Error('Recovery phrase is missing');
      }

      setError(null);

      try {
        await persistOnboardedWallet({
          mnemonic: state.mnemonic,
          password,
          label: state.walletLabel ?? 'Ancore Wallet',
        });
        clearSensitiveData();
        complete();
        onComplete?.();
      } catch (persistError) {
        const message =
          persistError instanceof Error ? persistError.message : 'Failed to save wallet securely';
        setError(message);
        throw new Error(message);
      }
    },
    [state.mnemonic, state.walletLabel, clearSensitiveData, complete, onComplete]
  );

  const handleCreateContinue = useCallback(
    (walletLabel: string) => {
      const mnemonic = generateMnemonic();
      setWalletLabel(walletLabel);
      setMnemonic(mnemonic);
      goTo('create-display');
    },
    [setWalletLabel, setMnemonic, goTo]
  );

  const handleImportContinue = useCallback(
    (mnemonic: string) => {
      setMnemonic(mnemonic);
      goTo('import-password');
    },
    [setMnemonic, goTo]
  );

  const handleCreatePasswordComplete = useCallback(
    async (password: string) => {
      await persistWallet(password);
    },
    [persistWallet]
  );

  const handleImportPasswordComplete = useCallback(
    async (password: string) => {
      await persistWallet(password);
    },
    [persistWallet]
  );

  const passwordScreen = (flow: 'create' | 'import') => (
    <>
      {error && <p role="alert">{error}</p>}
      <PasswordScreen
        flow={flow}
        onBack={back}
        onCancel={cancel}
        onComplete={flow === 'create' ? handleCreatePasswordComplete : handleImportPasswordComplete}
      />
    </>
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
      return passwordScreen('create');
    case 'import':
      return (
        <WalletImportScreen onBack={back} onCancel={cancel} onContinue={handleImportContinue} />
      );
    case 'import-password':
      return passwordScreen('import');
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
  onComplete,
}: {
  initialState?: Partial<OnboardingState>;
  onComplete?: () => void;
}) {
  const contextValue = useOnboardingNavigator(initialState);

  return (
    <OnboardingContext.Provider value={contextValue}>
      <OnboardingRouteView onComplete={onComplete} />
    </OnboardingContext.Provider>
  );
}

export function OnboardingNavigatorTestHarness({
  initialState,
}: {
  initialState?: Partial<OnboardingState>;
}) {
  return <OnboardingNavigator initialState={initialState} />;
}
