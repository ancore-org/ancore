import { MobileWalletEnvironmentError, loadMobileWalletEnvironment } from '../environment';

describe('loadMobileWalletEnvironment', () => {
  it('loads defaults for the testnet mobile wallet environment', () => {
    const environment = loadMobileWalletEnvironment({
      ANCORE_ACCOUNT_CONTRACT_ID: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
      ANCORE_MOBILE_READONLY_ACCOUNT_ADDRESS: 'GABC123',
    });

    expect(environment).toMatchObject({
      accountContractId: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
      appName: 'Ancore Mobile Wallet',
      network: 'testnet',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      readOnlyAccountAddress: 'GABC123',
    });
  });

  it('throws when the account contract id is missing', () => {
    expect(() => loadMobileWalletEnvironment({})).toThrow(MobileWalletEnvironmentError);
    expect(() => loadMobileWalletEnvironment({})).toThrow('ANCORE_ACCOUNT_CONTRACT_ID is required');
  });

  it('loads futurenet defaults when requested', () => {
    const environment = loadMobileWalletEnvironment({
      ANCORE_ACCOUNT_CONTRACT_ID: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
      ANCORE_MOBILE_NETWORK: 'futurenet',
    });

    expect(environment).toMatchObject({
      network: 'futurenet',
      rpcUrl: 'https://rpc-futurenet.stellar.org',
      networkPassphrase: 'Test SDF Future Network ; October 2022',
    });
  });

  it('throws when the requested network is unsupported', () => {
    expect(() =>
      loadMobileWalletEnvironment({
        ANCORE_ACCOUNT_CONTRACT_ID: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
        ANCORE_MOBILE_NETWORK: 'devnet',
      })
    ).toThrow('Unsupported ANCORE_MOBILE_NETWORK');
  });
});
