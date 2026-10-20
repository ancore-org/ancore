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
      const {
        accessibilityLabel,
        accessibilityRole,
        accessibilityState,
        children,
        onChangeText,
        onPress,
        ...rest
      } = props;
      return React.createElement(
        tag,
        {
          ...rest,
          'aria-label': accessibilityLabel,
          'aria-disabled':
            accessibilityState && (accessibilityState as { disabled?: boolean }).disabled,
          onChange: onChangeText
            ? (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value)
            : undefined,
          onClick: onPress,
          role: accessibilityRole === 'header' ? 'heading' : accessibilityRole,
        },
        children
      );
    };

    return {
      View: (props: Record<string, unknown>) => element('div', props),
      Text: (props: Record<string, unknown>) =>
        element(props.accessibilityRole === 'header' ? 'h1' : 'span', props),
      TextInput: (props: Record<string, unknown>) => element('input', props),
      Pressable: (props: Record<string, unknown>) => element('button', props),
      StyleSheet: { create: (styles: Record<string, unknown>) => styles },
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
