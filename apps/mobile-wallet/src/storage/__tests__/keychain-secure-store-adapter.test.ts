import * as Keychain from 'react-native-keychain';

import {
  DEV_BUNDLE_ID,
  KEYCHAIN_USERNAME,
  KeychainSecureStoreAdapter,
  PROD_BUNDLE_ID,
} from '../keychain-secure-store-adapter';

// react-native-keychain is a native module; mock it virtually since it is not
// installed in this standalone library package (it ships with the host app #780).
jest.mock(
  'react-native-keychain',
  () => ({
    getGenericPassword: jest.fn(),
    setGenericPassword: jest.fn(),
    resetGenericPassword: jest.fn(),
  }),
  { virtual: true }
);

const mockKeychain = Keychain as jest.Mocked<typeof Keychain>;

/**
 * Builds an in-memory fake of the Keychain native module so multi-step flows
 * (set → cold start → get) can be exercised without a device.
 */
function installKeychainFake(): Map<string, string> {
  const store = new Map<string, string>();

  mockKeychain.setGenericPassword.mockImplementation(
    async (_username: string, password: string, options?: { service?: string }) => {
      store.set(options?.service ?? '', password);
      return { service: options?.service ?? '', storage: 'keychain' };
    }
  );

  mockKeychain.getGenericPassword.mockImplementation(async (options?: { service?: string }) => {
    const service = options?.service ?? '';

    if (!store.has(service)) {
      return false;
    }

    return { service, username: KEYCHAIN_USERNAME, password: store.get(service) as string };
  });

  mockKeychain.resetGenericPassword.mockImplementation(async (options?: { service?: string }) => {
    return store.delete(options?.service ?? '');
  });

  return store;
}

describe('KeychainSecureStoreAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes values to the bundle-scoped Keychain service', async () => {
    mockKeychain.setGenericPassword.mockResolvedValue({
      service: `${PROD_BUNDLE_ID}.vault_key`,
      storage: 'keychain',
    });
    mockKeychain.getGenericPassword.mockResolvedValue(false);

    const adapter = new KeychainSecureStoreAdapter({ bundleId: PROD_BUNDLE_ID });
    await adapter.set('vault_key', 'encrypted_data');

    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      KEYCHAIN_USERNAME,
      'encrypted_data',
      { service: 'org.ancore.wallet.vault_key' }
    );
  });

  it('returns null when no entry exists', async () => {
    mockKeychain.getGenericPassword.mockResolvedValue(false);

    const adapter = new KeychainSecureStoreAdapter({ bundleId: PROD_BUNDLE_ID });

    await expect(adapter.get('missing')).resolves.toBeNull();
    expect(mockKeychain.getGenericPassword).toHaveBeenCalledWith({
      service: 'org.ancore.wallet.missing',
    });
  });

  it('round-trips raw encrypted payload strings through Keychain', async () => {
    installKeychainFake();

    const adapter = new KeychainSecureStoreAdapter({ bundleId: PROD_BUNDLE_ID });
    const vaultState = '{"salt":"c2FsdA==","iv":"aXY=","data":"ZGF0YQ=="}';

    await adapter.set('mobile_vault_state', vaultState);

    // Simulate a cold start with a fresh adapter instance over the same store.
    const restarted = new KeychainSecureStoreAdapter({ bundleId: PROD_BUNDLE_ID });

    await expect(restarted.get('mobile_vault_state')).resolves.toEqual(vaultState);
  });

  it('removes an entry by resetting its service', async () => {
    const store = installKeychainFake();

    const adapter = new KeychainSecureStoreAdapter({ bundleId: PROD_BUNDLE_ID });
    await adapter.set('mobile_vault_state', { secret: true });
    await adapter.remove('mobile_vault_state');

    expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'org.ancore.wallet.mobile_vault_state',
    });
    expect(store.has('org.ancore.wallet.mobile_vault_state')).toBe(false);
    await expect(adapter.get('mobile_vault_state')).resolves.toBeNull();
  });

  it('clears every previously written key plus the index', async () => {
    const store = installKeychainFake();

    const adapter = new KeychainSecureStoreAdapter({ bundleId: PROD_BUNDLE_ID });
    await adapter.set('mobile_vault_state', { a: 1 });
    await adapter.set('mobile_vault_accounts', { b: 2 });

    await adapter.clear();

    expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'org.ancore.wallet.mobile_vault_state',
    });
    expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'org.ancore.wallet.mobile_vault_accounts',
    });
    expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'org.ancore.wallet.__keys__',
    });
    expect(store.size).toBe(0);
  });

  it('scopes the service name to the dev bundle ID when configured', async () => {
    mockKeychain.getGenericPassword.mockResolvedValue(false);
    mockKeychain.setGenericPassword.mockResolvedValue({
      service: `${DEV_BUNDLE_ID}.k`,
      storage: 'keychain',
    });

    const adapter = new KeychainSecureStoreAdapter({ bundleId: DEV_BUNDLE_ID });
    await adapter.set('k', 'v');

    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(KEYCHAIN_USERNAME, 'v', {
      service: 'org.ancore.wallet.dev.k',
    });
  });

  it('defaults to the production bundle ID when none is provided', async () => {
    installKeychainFake();

    const adapter = new KeychainSecureStoreAdapter();
    await adapter.set('k', 'v');

    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(KEYCHAIN_USERNAME, 'v', {
      service: `${PROD_BUNDLE_ID}.k`,
    });
  });

  it('defaults to the development bundle ID when __DEV__ is set', async () => {
    installKeychainFake();
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    try {
      const adapter = new KeychainSecureStoreAdapter();
      await adapter.set('k', 'v');

      expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(KEYCHAIN_USERNAME, 'v', {
        service: `${DEV_BUNDLE_ID}.k`,
      });
    } finally {
      delete (globalThis as { __DEV__?: boolean }).__DEV__;
    }
  });

  it('tolerates a corrupt key index without throwing', async () => {
    mockKeychain.getGenericPassword.mockResolvedValue({
      service: `${PROD_BUNDLE_ID}.__keys__`,
      username: KEYCHAIN_USERNAME,
      password: 'not-json',
    });
    mockKeychain.resetGenericPassword.mockResolvedValue(true);

    const adapter = new KeychainSecureStoreAdapter({ bundleId: PROD_BUNDLE_ID });

    await expect(adapter.clear()).resolves.toBeUndefined();
    // Falls back to clearing just the index service.
    expect(mockKeychain.resetGenericPassword).toHaveBeenCalledWith({
      service: 'org.ancore.wallet.__keys__',
    });
  });
});
