import { bootstrapMobileWallet, type MobileWalletBootstrap } from '../bootstrap';

jest.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
  },
}), { virtual: true });

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}), { virtual: true });

describe('bootstrapMobileWallet', () => {
  it('wires environment, SDK client, and read-only account state', () => {
    const bootstrap = bootstrapMobileWallet({
      ANCORE_ACCOUNT_CONTRACT_ID: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
      ANCORE_MOBILE_APP_NAME: 'Ancore Preview',
      ANCORE_MOBILE_READONLY_ACCOUNT_ID: 'alice',
      ANCORE_MOBILE_READONLY_ACCOUNT_ADDRESS: 'GABC123',
    });

    expect(bootstrap.environment.appName).toBe('Ancore Preview');
    expect(bootstrap.sdk.accountContractId).toBe(
      'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526'
    );
    expect(bootstrap.account).toMatchObject({
      id: 'alice',
      address: { value: 'GABC123' },
      status: 'ready',
    });
  });

  it('fails before rendering when required SDK configuration is absent', () => {
    expect(() => bootstrapMobileWallet({})).toThrow('ANCORE_ACCOUNT_CONTRACT_ID is required');
  });
});
