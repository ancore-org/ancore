import { KeychainSecureStoreAdapter, PROD_BUNDLE_ID } from '../keychain-secure-store-adapter';
import { MemorySecureStoreAdapter } from '../mobile-secure-storage-adapter';
import { createSecureStoreAdapter, isJestEnvironment } from '../secure-store-factory';

jest.mock(
  'react-native-keychain',
  () => ({
    getGenericPassword: jest.fn().mockResolvedValue(false),
    setGenericPassword: jest.fn().mockResolvedValue({ service: 's', storage: 'keychain' }),
    resetGenericPassword: jest.fn().mockResolvedValue(true),
  }),
  { virtual: true }
);

describe('createSecureStoreAdapter', () => {
  it('detects the Jest environment', () => {
    expect(isJestEnvironment()).toBe(true);
  });

  it('returns the in-memory adapter under Jest', () => {
    const adapter = createSecureStoreAdapter();

    expect(adapter).toBeInstanceOf(MemorySecureStoreAdapter);
    expect(adapter).not.toBeInstanceOf(KeychainSecureStoreAdapter);
  });

  it('returns the Keychain adapter when production is forced', () => {
    const adapter = createSecureStoreAdapter({ forceProduction: true, bundleId: PROD_BUNDLE_ID });

    expect(adapter).toBeInstanceOf(KeychainSecureStoreAdapter);
  });

  it('wires the forced Keychain adapter to the native module', async () => {
    const Keychain = jest.requireMock('react-native-keychain') as {
      setGenericPassword: jest.Mock;
    };

    const adapter = createSecureStoreAdapter({ forceProduction: true, bundleId: PROD_BUNDLE_ID });
    await adapter.set('vault_key', 'encrypted_data');

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('ancore', 'encrypted_data', {
      service: 'org.ancore.wallet.vault_key',
    });
  });
});
