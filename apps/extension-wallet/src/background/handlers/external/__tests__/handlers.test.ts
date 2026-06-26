/**
 * Unit tests for handleGetPublicKey and handleGetNetwork (#809)
 */

import { handleGetPublicKey, handleGetNetwork } from '../handlers';
import type { ExternalHandlerContext } from '@ancore/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = 'CABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

const localStore: Record<string, unknown> = {};

const mockLocalStorage = {
  get: vi.fn((key: string, cb: (result: Record<string, unknown>) => void) => {
    cb({ [key]: localStore[key] ?? null });
  }),
  set: vi.fn((data: Record<string, unknown>, cb?: () => void) => {
    Object.assign(localStore, data);
    cb?.();
  }),
};

vi.mock('@/stores/settings', () => ({
  getSettingsState: () => ({ network: 'testnet' }),
}));

vi.mock('../allowlist', () => ({
  isAllowed: vi.fn().mockResolvedValue(true),
  addToAllowlist: vi.fn(),
}));

// Re-set globalThis.chrome in beforeEach because vitest.setup.ts deletes it
// before every test to prevent leakage between files.
beforeEach(() => {
  (globalThis as any).chrome = { storage: { local: mockLocalStorage } };
  Object.keys(localStore).forEach((k) => delete localStore[k]);
  mockLocalStorage.get.mockClear();
});

function makeCtx(origin = 'https://dapp.example'): ExternalHandlerContext {
  return {
    origin,
    params: {},
    requestId: 'test-req-id',
    sender: {},
  };
}

// ── handleGetPublicKey ────────────────────────────────────────────────────────

describe('handleGetPublicKey', () => {
  it('returns the stored contract address as publicKey', async () => {
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;

    const result = await handleGetPublicKey(makeCtx());
    expect(result.publicKey).toBe(CONTRACT_ADDRESS);
  });

  it('throws when wallet is not onboarded (no stored address)', async () => {
    await expect(handleGetPublicKey(makeCtx())).rejects.toThrow('Wallet not set up');
  });

  it('throws when origin is not in the allowlist', async () => {
    const { isAllowed } = await import('../allowlist');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;

    await expect(handleGetPublicKey(makeCtx('https://untrusted.example'))).rejects.toThrow(
      'Origin not allowed'
    );
  });
});

// ── handleGetNetwork ──────────────────────────────────────────────────────────

describe('handleGetNetwork', () => {
  it('returns network and passphrase for testnet', async () => {
    const result = await handleGetNetwork(makeCtx());
    expect(result.network).toBe('testnet');
    expect(result.networkPassphrase).toBe('Test SDF Network ; September 2015');
  });

  it('throws when origin is not in the allowlist', async () => {
    const { isAllowed } = await import('../allowlist');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);

    await expect(handleGetNetwork(makeCtx('https://untrusted.example'))).rejects.toThrow(
      'Origin not allowed'
    );
  });
});
