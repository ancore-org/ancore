/**
 * Unit tests for handleGetPublicKey and handleGetNetwork (#809)
 */

import { handleGetPublicKey, handleGetNetwork, handleRequestAccess } from '../handlers';
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

vi.mock('../response-queue', () => ({
  enqueueApproval: vi.fn(),
  registerResponseCallbacks: vi.fn(),
}));

vi.mock('../../../approval-window', () => ({
  openApprovalWindow: vi.fn().mockResolvedValue(undefined),
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

describe('handleRequestAccess', () => {
  it('waits for user approval before adding the origin to the allowlist', async () => {
    const { isAllowed, addToAllowlist } = await import('../allowlist');
    const { enqueueApproval, registerResponseCallbacks } = await import('../response-queue');
    const { openApprovalWindow } = await import('../../../approval-window');

    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    vi.mocked(registerResponseCallbacks).mockImplementation((_requestId, resolve) => resolve({ ok: true }));

    const result = await handleRequestAccess(makeCtx('https://dapp.example'));

    expect(enqueueApproval).toHaveBeenCalled();
    expect(openApprovalWindow).toHaveBeenCalledWith('test-req-id', 'grant-access');
    expect(addToAllowlist).toHaveBeenCalledWith('testnet', 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'https://dapp.example');
    expect(result).toEqual({ smartAccountId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', network: 'testnet' });
  });

  it('does not add the origin to the allowlist when the user rejects access', async () => {
    const { isAllowed, addToAllowlist } = await import('../allowlist');
    const { registerResponseCallbacks } = await import('../response-queue');

    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    vi.mocked(registerResponseCallbacks).mockImplementation((_requestId, _resolve, reject) => reject(new Error('User rejected')));

    await expect(handleRequestAccess(makeCtx('https://dapp.example'))).rejects.toThrow('User rejected');
    expect(addToAllowlist).not.toHaveBeenCalled();
  });
});
