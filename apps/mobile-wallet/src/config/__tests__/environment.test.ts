import { MobileWalletEnvironmentError, loadMobileWalletEnvironment } from '../environment';

describe('loadMobileWalletEnvironment', () => {
  const baseEnv = {
    ANCORE_ACCOUNT_CONTRACT_ID: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
    EXPO_PUBLIC_INDEXER_URL: 'http://localhost:3000',
    EXPO_PUBLIC_RELAYER_URL: 'http://localhost:3001',
  };

  it('loads defaults for the testnet mobile wallet environment', () => {
    const environment = loadMobileWalletEnvironment({
      ...baseEnv,
      ANCORE_MOBILE_READONLY_ACCOUNT_ADDRESS: 'GABC123',
    });

    expect(environment).toMatchObject({
      accountContractId: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
      appName: 'Ancore Mobile Wallet',
      network: 'testnet',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      indexerUrl: 'http://localhost:3000',
      relayerUrl: 'http://localhost:3001',
      readOnlyAccountAddress: 'GABC123',
    });
  });

  it('throws when the account contract id is missing', () => {
    expect(() => loadMobileWalletEnvironment({})).toThrow(MobileWalletEnvironmentError);
    expect(() => loadMobileWalletEnvironment({})).toThrow('ANCORE_ACCOUNT_CONTRACT_ID is required');
  });

  it('throws when service URLs are malformed', () => {
    expect(() =>
      loadMobileWalletEnvironment({
        ...baseEnv,
        EXPO_PUBLIC_INDEXER_URL: 'not-a-url',
      })
    ).toThrow('indexer URL is not a valid URL');
  });

  it('loads futurenet defaults when requested', () => {
    const environment = loadMobileWalletEnvironment({
      ...baseEnv,
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
        ...baseEnv,
        ANCORE_MOBILE_NETWORK: 'devnet',
      })
    ).toThrow('Unsupported ANCORE_MOBILE_NETWORK');
  });
});
