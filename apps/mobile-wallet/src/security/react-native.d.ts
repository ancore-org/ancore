import type * as React from 'react';

/**
 * Minimal ambient declaration for the subset of `react-native` used by
 * {@link MobileSecureVault} and WalletConnect deep link handling.
 */

declare module 'react-native' {
  export interface NativeComponentProps {
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { disabled?: boolean };
    children?: React.ReactNode;
    disabled?: boolean;
    onChangeText?: (value: string) => void;
    onPress?: () => void;
    placeholder?: string;
    style?: unknown;
    value?: string;
  }
  export const View: React.ComponentType<NativeComponentProps>;
  export const Text: React.ComponentType<NativeComponentProps>;
  export const TextInput: React.ComponentType<NativeComponentProps>;
  export const Pressable: React.ComponentType<NativeComponentProps>;
  export const StyleSheet: {
    create<T extends Record<string, unknown>>(styles: T): T;
  };
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

  export interface DeviceEventEmitterStatic {
    addListener(eventType: string, listener: (event: string) => void): { remove: () => void };
  }

  export const DeviceEventEmitter: DeviceEventEmitterStatic;
}
