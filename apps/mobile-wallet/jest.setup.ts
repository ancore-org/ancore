import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;

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
