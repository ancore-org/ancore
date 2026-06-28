import { MemoryNonceStore } from '../../src/store/nonceStore';

describe('NonceStore', () => {
  it('allows fresh nonces and tracks them', () => {
    const store = new MemoryNonceStore();
    const key = 'session-1';

    expect(() => store.assertFresh(key, 100)).not.toThrow();
    store.track(key, 100);

    expect(() => store.assertFresh(key, 100)).toThrow('Nonce already used');
    expect(() => store.assertFresh(key, 101)).not.toThrow();
  });

  it('keeps track of nonces per session key independently', () => {
    const store = new MemoryNonceStore();
    const key1 = 'session-1';
    const key2 = 'session-2';

    store.track(key1, 100);
    expect(() => store.assertFresh(key1, 100)).toThrow('Nonce already used');
    expect(() => store.assertFresh(key2, 100)).not.toThrow();
  });

  it('evicts expired nonces based on TTL', async () => {
    const store = new MemoryNonceStore(50); // 50ms TTL
    const key = 'session-1';

    store.track(key, 100);
    expect(() => store.assertFresh(key, 100)).toThrow('Nonce already used');
    expect(store.size(key)).toBe(1);

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(() => store.assertFresh(key, 100)).not.toThrow();
    expect(store.size(key)).toBe(0);
  });

  it('clears expired nonces for all session keys', async () => {
    const store = new MemoryNonceStore(50);
    const key1 = 'session-1';
    const key2 = 'session-2';

    store.track(key1, 100);
    store.track(key2, 200);

    expect(store.size(key1)).toBe(1);
    expect(store.size(key2)).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 60));

    store.clearExpired();
    // Use the private seen map reflection or size check to ensure cleanup
    expect(store.size(key1)).toBe(0);
    expect(store.size(key2)).toBe(0);
  });
});
