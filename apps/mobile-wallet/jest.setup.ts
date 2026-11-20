/* global jest */

import '@testing-library/jest-dom';
import React from 'react';
import { TextEncoder, TextDecoder } from 'util';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

jest.mock(
  'react-native',
  () => {
    const element = (tag: string, props: Record<string, unknown> = {}) => {
      // React Native-only props with no DOM equivalent are dropped so they do not
      // reach the DOM element (and trigger React's unknown-attribute warnings).
      const {
        accessibilityElementsHidden,
        accessibilityLabel,
        accessibilityLiveRegion,
        accessibilityRole,
        accessibilityState,
        accessible: _accessible,
        children,
        importantForAccessibility: _importantForAccessibility,
        onChangeText,
        onPress,
        returnKeyType: _returnKeyType,
        style,
        textContentType: _textContentType,
        ...rest
      } = props;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : ((style as Record<string, unknown>) ?? {});
      return React.createElement(
        tag,
        {
          ...rest,
          style: flatStyle,
          'data-testid': rest.testID ?? rest['data-testid'],
          'aria-hidden': accessibilityElementsHidden,
          'aria-label': accessibilityLabel,
          'aria-live': accessibilityLiveRegion,
          'aria-disabled':
            accessibilityState && (accessibilityState as { disabled?: boolean }).disabled,
          onChange: onChangeText
            ? (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value)
            : undefined,
          onClick: onPress,
          role:
            accessibilityRole === 'header'
              ? 'heading'
              : accessibilityRole === 'image'
                ? 'img'
                : accessibilityRole,
        },
        typeof children === 'function' ? children({ pressed: false }) : children
      );
    };

    return {
      View: (props: Record<string, unknown>) => element('div', props),
      ScrollView: (props: Record<string, unknown>) => element('div', props),
      Text: (props: Record<string, unknown>) =>
        element(props.accessibilityRole === 'header' ? 'h1' : 'span', props),
      // Maps the React Native props that change behaviour onto the DOM so tests can
      // observe them: `editable={false}` disables the field, `onSubmitEditing` fires on
      // Enter, and `secureTextEntry` is exposed as a data attribute (not `type`, so
      // role queries for the field keep working).
      TextInput: (props: Record<string, unknown>) => {
        const {
          secureTextEntry,
          editable,
          onSubmitEditing,
          autoCorrect: _autoCorrect,
          ...inputProps
        } = props;
        return element('input', {
          ...inputProps,
          'data-secure-text-entry': secureTextEntry ? 'true' : undefined,
          disabled: editable === false ? true : inputProps.disabled,
          onKeyDown: onSubmitEditing
            ? (event: React.KeyboardEvent) => {
                if (event.key === 'Enter') (onSubmitEditing as (e: unknown) => void)(event);
              }
            : inputProps.onKeyDown,
        });
      },
      Pressable: (props: Record<string, unknown>) => element('button', props),
      TouchableOpacity: (props: Record<string, unknown>) => element('button', props),
      Modal: (props: Record<string, unknown>) =>
        props.visible === false ? null : element('div', props),
      ActivityIndicator: (props: Record<string, unknown>) => element('div', props),
      RefreshControl: (props: Record<string, unknown>) => element('div', props),
      FlatList: (props: Record<string, unknown>) => {
        const data = (props.data as unknown[]) ?? [];
        const renderItem = props.renderItem as
          | ((info: {
              item: unknown;
              index: number;
              separators: Record<string, unknown>;
            }) => React.ReactNode)
          | undefined;
        const keyExtractor = props.keyExtractor as
          | ((item: unknown, index: number) => string)
          | undefined;
        const empty = props.ListEmptyComponent as
          | React.ComponentType
          | React.ReactElement
          | null
          | undefined;
        const header = props.ListHeaderComponent as
          | React.ComponentType
          | React.ReactElement
          | null
          | undefined;
        const footer = props.ListFooterComponent as
          | React.ComponentType
          | React.ReactElement
          | null
          | undefined;
        const renderNode = (node: unknown) => {
          if (!node) return null;
          if (React.isValidElement(node)) return node;
          if (typeof node === 'function') return React.createElement(node as React.ComponentType);
          return null;
        };
        return React.createElement(
          'div',
          {
            'data-testid': props.testID as string | undefined,
            'aria-label': props.accessibilityLabel as string | undefined,
          },
          renderNode(header),
          React.createElement(
            'ul',
            { 'aria-label': (props.accessibilityLabel as string | undefined) ?? 'list' },
            data.length === 0
              ? renderNode(empty)
              : data.map((item, index) =>
                  React.createElement(
                    'li',
                    { key: keyExtractor ? keyExtractor(item, index) : String(index) },
                    renderItem ? renderItem({ item, index, separators: {} }) : null
                  )
                )
          ),
          renderNode(footer)
        );
      },
      Alert: {
        alert: jest.fn(),
      },
      Clipboard: {
        setString: jest.fn(),
        getString: jest.fn().mockResolvedValue(''),
      },
      Platform: {
        OS: 'ios',
        select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
      },
      AppState: {
        currentState: 'active',
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      StyleSheet: {
        create: (styles: Record<string, unknown>) => styles,
        flatten: (style: unknown) =>
          Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style ?? {}),
      },
      Linking: {
        getInitialURL: jest.fn().mockResolvedValue(null),
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      },
      DeviceEventEmitter: {
        addListener: jest.fn(() => ({ remove: jest.fn() })),
      },
    };
  },
  { virtual: true }
);

jest.mock(
  'react-native-haptic-feedback',
  () => ({
    __esModule: true,
    default: {
      trigger: jest.fn(),
    },
    trigger: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  'react-native-qrcode-svg',
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-testid': (props.testID as string | undefined) ?? 'qr-code-svg',
        'data-value': props.value,
      }),
  }),
  { virtual: true }
);

// `react-native-keychain` is a native module that is not installed in this
// standalone library package (it arrives with the host app, #780). Register a
// virtual mock so any module importing the storage barrel — which re-exports the
// Keychain adapter — resolves in unit tests. Suites that assert on Keychain calls
// override this with their own `jest.mock` factory.
jest.mock(
  'react-native-keychain',
  () => ({
    getGenericPassword: jest.fn().mockResolvedValue(false),
    setGenericPassword: jest.fn().mockResolvedValue({ service: '', storage: 'keychain' }),
    resetGenericPassword: jest.fn().mockResolvedValue(true),
  }),
  { virtual: true }
);

// WalletConnect / Reown pull ESM-only deps that break Jest without a full RN transform.
// Provide a virtual kit mock; individual suites can override.
jest.mock(
  '@walletconnect/utils',
  () => ({
    buildApprovedNamespaces: jest.fn(
      ({ supportedNamespaces }: { supportedNamespaces: unknown }) => supportedNamespaces
    ),
    getSdkError: jest.fn((_key: string, message?: string) => ({
      code: 4001,
      message: message ?? 'User rejected',
    })),
  }),
  { virtual: true }
);

jest.mock(
  '@walletconnect/core',
  () => ({
    Core: jest.fn().mockImplementation(() => ({ id: 'mock-core' })),
  }),
  { virtual: true }
);

jest.mock(
  '@reown/walletkit',
  () => ({
    WalletKit: {
      init: jest.fn(async () => ({
        on: jest.fn(),
        off: jest.fn(),
        pair: jest.fn(),
        respondSessionRequest: jest.fn(),
        rejectSession: jest.fn(),
        approveSession: jest.fn(),
        getActiveSessions: jest.fn(() => ({})),
      })),
    },
  }),
  { virtual: true }
);
