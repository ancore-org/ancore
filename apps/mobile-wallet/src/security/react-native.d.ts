/**
 * Minimal ambient declaration for the subset of `react-native` used by
 * {@link MobileSecureVault}.
 */
declare module 'react-native' {
  export type AppStateEvent = 'change' | 'focus' | 'blur';
  export type AppStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

  export interface AppStateStatic {
    currentState: AppStatus;
    addEventListener(
      type: AppStateEvent,
      handler: (state: AppStatus) => void
    ): { remove: () => void };
  }

  export const AppState: AppStateStatic;
}
