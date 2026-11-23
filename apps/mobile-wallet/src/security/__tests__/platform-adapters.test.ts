import type { SecureStoreAdapter } from '../../storage/types';
import { makeSecureStorageAdapter, WalletPasswordAuthService } from '../platform-adapters';

describe('WalletPasswordAuthService', () => {
  it('returns true and forwards the password when the verifier accepts it', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const service = new WalletPasswordAuthService(verify);

    await expect(service.authenticate('correct horse battery staple')).resolves.toBe(true);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('correct horse battery staple');
  });

  it('returns false when the verifier rejects the password', async () => {
    const verify = jest.fn().mockResolvedValue(false);
    const service = new WalletPasswordAuthService(verify);

    await expect(service.authenticate('wrong password')).resolves.toBe(false);
    expect(verify).toHaveBeenCalledWith('wrong password');
  });

  it('propagates verifier errors to the caller', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('verifier unavailable'));
    const service = new WalletPasswordAuthService(verify);

    await expect(service.authenticate('anything')).rejects.toThrow('verifier unavailable');
  });
});

describe('makeSecureStorageAdapter', () => {
  function createStore(): SecureStoreAdapter {
    return {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    } as SecureStoreAdapter;
  }

  it('delegates getItem to the underlying store', async () => {
    const store = createStore();
    (store.get as jest.Mock).mockResolvedValue('stored-value');
    const adapter = makeSecureStorageAdapter(store);

    await expect(adapter.getItem('vault-key')).resolves.toBe('stored-value');
    expect(store.get).toHaveBeenCalledWith('vault-key');
  });

  it('returns null from getItem when the store has no value', async () => {
    const store = createStore();
    (store.get as jest.Mock).mockResolvedValue(null);
    const adapter = makeSecureStorageAdapter(store);

    await expect(adapter.getItem('missing')).resolves.toBeNull();
  });

  it('delegates setItem to the underlying store', async () => {
    const store = createStore();
    (store.set as jest.Mock).mockResolvedValue(undefined);
    const adapter = makeSecureStorageAdapter(store);

    await adapter.setItem('vault-key', 'ciphertext');
    expect(store.set).toHaveBeenCalledWith('vault-key', 'ciphertext');
  });

  it('delegates removeItem to the underlying store', async () => {
    const store = createStore();
    (store.remove as jest.Mock).mockResolvedValue(undefined);
    const adapter = makeSecureStorageAdapter(store);

    await adapter.removeItem('vault-key');
    expect(store.remove).toHaveBeenCalledWith('vault-key');
  });
});
