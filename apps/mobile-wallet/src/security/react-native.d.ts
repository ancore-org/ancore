/**
 * Minimal ambient declaration for the subset of `react-native` used by
 * {@link MobileSecureVault} and WalletConnect deep link handling.
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

  export interface LinkingUrlEvent {
    url: string;
  }

  export interface LinkingStatic {
    getInitialURL(): Promise<string | null>;
    addEventListener(
      type: 'url',
      handler: (event: LinkingUrlEvent) => void
    ): { remove: () => void };
  }

  export const Linking: LinkingStatic;
}
