/**
 * Ambient declaration for React Native primitives and APIs used across the
 * mobile wallet library.
 */

declare module 'react-native' {
  import type { ComponentType, ReactNode } from 'react';

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

  // React Native Primitives & Styling Types
  export type StyleProp<T> = T | Array<T | undefined | null | false> | undefined | null | false;
  export type ViewStyle = Record<string, any>;
  export type TextStyle = Record<string, any>;
  export type ImageStyle = Record<string, any>;

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    testID?: string;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { disabled?: boolean; [key: string]: any };
    ariaLabel?: string;
    ariaHidden?: boolean;
    role?: string;
    id?: string;
    [key: string]: any;
  }

  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: ReactNode;
    testID?: string;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    role?: string;
    id?: string;
    [key: string]: any;
  }

  export interface TextInputProps {
    style?: StyleProp<TextStyle>;
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    onChangeText?: (text: string) => void;
    onChange?: (e: any) => void;
    testID?: string;
    editable?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    keyboardType?: string;
    returnKeyType?: string;
    onSubmitEditing?: () => void;
    accessibilityLabel?: string;
    role?: string;
    id?: string;
    [key: string]: any;
  }

  export interface TouchableOpacityProps extends ViewProps {
    onPress?: (e?: any) => void;
    onLongPress?: () => void;
    disabled?: boolean;
    activeOpacity?: number;
    [key: string]: any;
  }

  export interface PressableProps extends ViewProps {
    onPress?: (e?: any) => void;
    disabled?: boolean;
    [key: string]: any;
  }

  export interface ScrollViewProps extends ViewProps {
    horizontal?: boolean;
    refreshControl?: ReactNode;
    [key: string]: any;
  }

  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const TouchableOpacity: ComponentType<TouchableOpacityProps>;
  export const Pressable: ComponentType<PressableProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const SafeAreaView: ComponentType<ViewProps>;
  export const ActivityIndicator: ComponentType<
    ViewProps & { size?: 'small' | 'large' | number; color?: string }
  >;
  export const Modal: ComponentType<
    ViewProps & {
      visible?: boolean;
      transparent?: boolean;
      animationType?: string;
      onRequestClose?: () => void;
    }
  >;
  export const FlatList: ComponentType<any>;

  export const StyleSheet: {
    create<T extends Record<string, any>>(styles: T): T;
    flatten<T>(style?: StyleProp<T>): T;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    select<T>(specifics: { [platform: string]: T }): T;
  };
}
