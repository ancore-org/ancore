import { useContext, createContext, useMemo, useReducer } from 'react';

import {
  DEFAULT_ONBOARDING_STATE,
  type OnboardingFlow,
  type OnboardingState,
} from '../screens/onboarding';
import { OnboardingCompleteScreen } from '../screens/onboarding/OnboardingCompleteScreen';
import { OnboardingEntryScreen } from '../screens/onboarding/OnboardingEntryScreen';
import { WalletCreateScreen } from '../screens/onboarding/WalletCreateScreen';
import { WalletImportScreen } from '../screens/onboarding/WalletImportScreen';
import { WalletRecoverScreen } from '../screens/onboarding/WalletRecoverScreen';

type OnboardingAction =
  | { type: 'start'; flow: OnboardingFlow }
  | { type: 'back' }
  | { type: 'cancel' }
  | { type: 'complete' }
  | { type: 'restart' };

type OnboardingContextValue = {
  state: OnboardingState;
  startCreate: () => void;
  startImport: () => void;
  startRecover: () => void;
  back: () => void;
  cancel: () => void;
  complete: () => void;
  restart: () => void;
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
      route: 'complete',
      flow: initialState.flow,
      history: ['entry', initialState.flow, 'complete'],
    };
  }

  if (
    (initialState.route === 'create' ||
      initialState.route === 'import' ||
      initialState.route === 'recover') &&
    initialState.flow === initialState.route
  ) {
    return {
      route: initialState.route,
      flow: initialState.flow,
      history: ['entry', initialState.route],
    };
  }

  return DEFAULT_ONBOARDING_STATE;
}

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'start':
      return {
        route: action.flow,
        flow: action.flow,
        history: ['entry', action.flow],
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
        route,
        flow: route as OnboardingFlow,
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

function OnboardingRouteView() {
  const { state, startCreate, startImport, startRecover, back, cancel, complete, restart } =
    useOnboardingContext();

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
      return <WalletCreateScreen onBack={back} onCancel={cancel} onContinue={complete} />;
    case 'import':
      return <WalletImportScreen onBack={back} onCancel={cancel} onContinue={complete} />;
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

export function OnboardingNavigator({ initialState }: { initialState?: Partial<OnboardingState> }) {
  const contextValue = useOnboardingNavigator(initialState);

  return (
    <OnboardingContext.Provider value={contextValue}>
      <OnboardingRouteView />
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
