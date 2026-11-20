/**
 * Ambient declarations for `react-native` and native peer modules used by
 * `@ancore/mobile-wallet`.
 */

declare module 'react-native' {
  import type * as React from 'react';

  export interface NativeComponentProps {
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: string;
    accessibilityLiveRegion?: 'none' | 'polite' | 'assertive' | string;
    accessibilityState?: {
      disabled?: boolean;
      selected?: boolean;
      checked?: boolean | 'mixed';
      busy?: boolean;
      expanded?: boolean;
    };
    children?: React.ReactNode;
    disabled?: boolean;
    onChangeText?: (value: string) => void;
    onPress?: (event?: any) => void;
    onRequestClose?: () => void;
    onTouchStart?: (event: any) => void;
    onTouchMove?: (event: any) => void;
    onTouchEnd?: (event?: any) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' | string;
    autoCorrect?: boolean;
    editable?: boolean;
    multiline?: boolean;
    numberOfLines?: number;
    style?: any;
    testID?: string;
    value?: string;
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade' | string;
    activeOpacity?: number;
    color?: string;
    size?: 'small' | 'large' | number | string;
    [key: string]: any;
  }

  export interface PressableStateCallbackType {
    pressed: boolean;
  }

  export interface PressableProps extends Omit<NativeComponentProps, 'children' | 'style'> {
    children?: React.ReactNode | ((state: PressableStateCallbackType) => React.ReactNode);
    style?: any | ((state: PressableStateCallbackType) => any);
  }

  export interface FlatListProps<ItemT = any> extends NativeComponentProps {
    data?: readonly ItemT[] | null;
    renderItem?: ListRenderItem<ItemT> | null;
    keyExtractor?: (item: ItemT, index: number) => string;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null;
    onEndReachedThreshold?: number | null;
    ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
    refreshControl?: React.ReactElement;
  }

  export const View: React.ComponentType<NativeComponentProps>;
  export const Text: React.ComponentType<NativeComponentProps>;
  export const TextInput: React.ComponentType<NativeComponentProps>;
  export const Pressable: React.ComponentType<PressableProps>;
  export const TouchableOpacity: React.ComponentType<NativeComponentProps>;
  export const Modal: React.ComponentType<NativeComponentProps>;
  export const ActivityIndicator: React.ComponentType<NativeComponentProps>;
  export const ScrollView: React.ComponentType<NativeComponentProps>;
  export function FlatList<ItemT = any>(props: FlatListProps<ItemT>): React.ReactElement | null;
  export const RefreshControl: React.ComponentType<any>;
  export const Alert: {
    alert(
      title: string,
      message?: string,
      buttons?: Array<{ text?: string; onPress?: () => void; style?: string }>,
      options?: any
    ): void;
  };

  export type ViewStyle = Record<string, any>;
  export type TextStyle = Record<string, any>;
  export type ImageStyle = Record<string, any>;
  export type StyleProp<T> = T | T[] | null | undefined | false;
  export type GestureResponderEvent = any;
  export interface ListRenderItemInfo<ItemT> {
    item: ItemT;
    index: number;
    separators: any;
  }
  export type ListRenderItem<ItemT> = (
    info: ListRenderItemInfo<ItemT>
  ) => React.ReactElement | null;

  export const StyleSheet: {
    create<T extends Record<string, any>>(styles: T): T;
    flatten(style?: any): any;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'macos' | 'windows' | 'web' | string;
    select<T>(specifics: Record<string, T>): T | undefined;
  };

  export const Clipboard: {
    setString(content: string): void;
    getString(): Promise<string>;
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

declare module 'react-native-qrcode-svg' {
  import type * as React from 'react';
  export interface QRCodeProps {
    value?: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    ecl?: 'L' | 'M' | 'Q' | 'H';
    quietZone?: number;
    testID?: string;
    [key: string]: any;
  }
  const QRCode: React.ComponentType<QRCodeProps>;
  export default QRCode;
}

declare module 'react-native-haptic-feedback' {
  export interface HapticOptions {
    enableVibrateFallback?: boolean;
    ignoreAndroidSystemSettings?: boolean;
  }
  const ReactNativeHapticFeedback: {
    trigger(type?: string, options?: HapticOptions): void;
  };
  export default ReactNativeHapticFeedback;
}
