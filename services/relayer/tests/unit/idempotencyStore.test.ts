import { IdempotencyStore } from '../../src/store/idempotency';

describe('IdempotencyStore', () => {
  it('returns undefined for an unknown key', () => {
    const store = new IdempotencyStore();
    expect(store.get('missing')).toBeUndefined();
  });

  it('returns a stored response for a known key', () => {
    const store = new IdempotencyStore();
    store.set('k1', { statusCode: 200, body: { success: true } });
    expect(store.get('k1')).toEqual({ statusCode: 200, body: { success: true } });
  });

  it('returns undefined after TTL has expired', async () => {
    const store = new IdempotencyStore(50); // 50 ms TTL
    store.set('k1', { statusCode: 200, body: {} });
    await new Promise((r) => setTimeout(r, 60));
    expect(store.get('k1')).toBeUndefined();
  });

  it('reports live entry count excluding expired keys', async () => {
    const store = new IdempotencyStore(50);
    store.set('a', { statusCode: 200, body: {} });
    store.set('b', { statusCode: 200, body: {} });
    expect(store.size()).toBe(2);
    await new Promise((r) => setTimeout(r, 60));
    expect(store.size()).toBe(0);
  });
});
