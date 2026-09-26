import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

jest.mock(
  'react-native',
  () => ({
    Linking: {
      getInitialURL: jest.fn().mockResolvedValue(null),
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    DeviceEventEmitter: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    },
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
