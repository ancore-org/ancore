import {
  NETWORK_PASSPHRASES,
  DEFAULT_HORIZON_URLS,
  DEFAULT_SOROBAN_RPC_URLS,
  NETWORK_CONFIGS,
  getNetworkConfig,
  resolveNetworkEndpoint,
  allowlistStorageKey,
  type StellarNetwork,
} from '../networks';

describe('wallet-shared / networks (#1450, #1452)', () => {
  const networks: StellarNetwork[] = ['mainnet', 'testnet', 'futurenet', 'local'];

  it('exports canonical NETWORK_PASSPHRASES for all supported networks', () => {
    expect(NETWORK_PASSPHRASES.mainnet).toBe('Public Global Stellar Network ; September 2015');
    expect(NETWORK_PASSPHRASES.testnet).toBe('Test SDF Network ; September 2015');
    expect(NETWORK_PASSPHRASES.futurenet).toBe('Test SDF Future Network ; October 2022');
    expect(NETWORK_PASSPHRASES.local).toBe('Standalone Network ; February 2017');
  });

  it('exports valid default Horizon and Soroban RPC URLs', () => {
    for (const net of networks) {
      expect(DEFAULT_HORIZON_URLS[net]).toBeDefined();
      expect(DEFAULT_HORIZON_URLS[net]).toMatch(/^https?:\/\//);
      expect(DEFAULT_SOROBAN_RPC_URLS[net]).toBeDefined();
      expect(DEFAULT_SOROBAN_RPC_URLS[net]).toMatch(/^https?:\/\//);
    }
  });

  it('provides NETWORK_CONFIGS with bundled settings for each network', () => {
    for (const net of networks) {
      const config = NETWORK_CONFIGS[net];
      expect(config).toBeDefined();
      expect(config.name).toBe(net);
      expect(config.passphrase).toBe(NETWORK_PASSPHRASES[net]);
      expect(config.horizonUrl).toBe(DEFAULT_HORIZON_URLS[net]);
      expect(config.sorobanRpcUrl).toBe(DEFAULT_SOROBAN_RPC_URLS[net]);
    }
  });

  it('retrieves config via getNetworkConfig helper', () => {
    const testnetConfig = getNetworkConfig('testnet');
    expect(testnetConfig.name).toBe('testnet');
    expect(testnetConfig.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(testnetConfig.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');

    expect(() => getNetworkConfig('unknown-network' as StellarNetwork)).toThrow('Unknown network: unknown-network');
  });

  it('resolves endpoints via resolveNetworkEndpoint with override support', () => {
    // Default resolution
    expect(resolveNetworkEndpoint('mainnet', 'horizon')).toBe('https://horizon.stellar.org');
    expect(resolveNetworkEndpoint('mainnet', 'rpc')).toBe('https://soroban-mainnet.stellar.org');
    expect(resolveNetworkEndpoint('testnet', 'horizon')).toBe('https://horizon-testnet.stellar.org');
    expect(resolveNetworkEndpoint('testnet', 'rpc')).toBe('https://soroban-testnet.stellar.org');

    // Override resolution
    const customRpc = 'https://custom-rpc.example.com';
    expect(resolveNetworkEndpoint('testnet', 'rpc', customRpc)).toBe(customRpc);

    const customHorizon = 'https://custom-horizon.example.com';
    expect(resolveNetworkEndpoint('mainnet', 'horizon', customHorizon)).toBe(customHorizon);
  });

  it('generates consistent allowlist storage keys', () => {
    const key = allowlistStorageKey('testnet', 'CA123456789');
    expect(key).toBe('ancore_allowlist_testnet_CA123456789');
  });
});
