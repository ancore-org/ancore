export type OnboardingFlow = 'create' | 'import' | 'recover';

export type OnboardingRoute =
  | 'entry'
  | 'create'
  | 'create-display'
  | 'create-verify'
  | 'create-password'
  | 'import'
  | 'import-password'
  | 'recover'
  | 'complete';

export interface OnboardingState {
  route: OnboardingRoute;
  flow: OnboardingFlow | null;
  history: OnboardingRoute[];
  mnemonic: string | null;
  password: string | null;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  route: 'entry',
  flow: null,
  history: ['entry'],
  mnemonic: null,
  password: null,
};
