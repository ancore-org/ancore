export type OnboardingFlow = 'create' | 'import' | 'recover';

export type OnboardingRoute = 'entry' | OnboardingFlow | 'complete';

export interface OnboardingState {
  route: OnboardingRoute;
  flow: OnboardingFlow | null;
  history: OnboardingRoute[];
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  route: 'entry',
  flow: null,
  history: ['entry'],
};
