/**
 * Unit tests for handleGetPublicKey, handleGetNetwork, and handleGetSmartAccount (#809, #960)
 */

import {
  handleGetPublicKey,
  handleGetNetwork,
  handleRequestAccess,
  handleGetSmartAccount,
  handleSignTransaction,
  handleSignAuthEntry,
  handleSignMessage,
  handleRequestSessionKey,
} from '../handlers';
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

// ── handleGetSmartAccount mocks ───────────────────────────────────────────────

let mockGetOwner: ReturnType<typeof vi.fn>;

vi.mock('@ancore/account-abstraction', () => ({
  AccountContract: vi.fn().mockImplementation(() => ({
    getOwner: (...args: unknown[]) => mockGetOwner(...args),
  })),
}));

vi.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: vi.fn().mockImplementation(() => ({
      getAccount: vi.fn().mockResolvedValue({ accountId: () => 'GAAA', sequenceNumber: () => '0' }),
      simulateTransaction: vi.fn(),
    })),
  },
}));

// Re-set globalThis.chrome in beforeEach because vitest.setup.ts deletes it
// before every test to prevent leakage between files.
beforeEach(() => {
  (globalThis as any).chrome = { storage: { local: mockLocalStorage } };
  Object.keys(localStore).forEach((k) => delete localStore[k]);
  // Clears recorded calls on every mock (implementations are preserved) so
  // assertions like `not.toHaveBeenCalled()` don't see calls from prior tests.
  vi.clearAllMocks();
  mockGetOwner = vi.fn();
});

function makeCtx(
  origin = 'https://dapp.example',
  params: Record<string, unknown> = {}
): ExternalHandlerContext {
  return {
    origin,
    params,
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
    vi.mocked(registerResponseCallbacks).mockImplementation((_requestId, resolve) =>
      resolve({ ok: true })
    );

    const result = await handleRequestAccess(makeCtx('https://dapp.example'));

    expect(enqueueApproval).toHaveBeenCalled();
    expect(openApprovalWindow).toHaveBeenCalledWith('test-req-id', 'grant-access');
    expect(addToAllowlist).toHaveBeenCalledWith(
      'testnet',
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      'https://dapp.example'
    );
    expect(result).toEqual({
      smartAccountId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      network: 'testnet',
    });
  });

  it('does not add the origin to the allowlist when the user rejects access', async () => {
    const { isAllowed, addToAllowlist } = await import('../allowlist');
    const { registerResponseCallbacks } = await import('../response-queue');

    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    vi.mocked(registerResponseCallbacks).mockImplementation((_requestId, _resolve, reject) =>
      reject(new Error('User rejected'))
    );

    await expect(handleRequestAccess(makeCtx('https://dapp.example'))).rejects.toThrow(
      'User rejected'
    );
    expect(addToAllowlist).not.toHaveBeenCalled();
  });
});

// ── handleGetSmartAccount ─────────────────────────────────────────────────────

describe('handleGetSmartAccount', () => {
  it('throws when wallet is not set up (no stored address and no params)', async () => {
    await expect(handleGetSmartAccount(makeCtx())).rejects.toThrow('Wallet not set up');
  });

  it('throws when origin is not in the allowlist', async () => {
    const { isAllowed } = await import('../allowlist');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;

    await expect(handleGetSmartAccount(makeCtx('https://untrusted.example'))).rejects.toThrow(
      'Origin not allowed'
    );
  });

  it('returns deployed status when contract exists on-chain', async () => {
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;
    mockGetOwner.mockResolvedValue('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');

    const result = await handleGetSmartAccount(makeCtx());
    expect(result.contractId).toBe(CONTRACT_ADDRESS);
    expect(result.deploymentStatus).toBe('deployed');
    expect(result.network).toBe('testnet');
  });

  it('returns not_deployed status when contract does not exist on-chain', async () => {
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;
    mockGetOwner.mockRejectedValue(new Error('contract not found'));

    const result = await handleGetSmartAccount(makeCtx());
    expect(result.contractId).toBe(CONTRACT_ADDRESS);
    expect(result.deploymentStatus).toBe('not_deployed');
    expect(result.network).toBe('testnet');
  });

  it('returns unknown status when RPC call fails for network reasons', async () => {
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;
    mockGetOwner.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await handleGetSmartAccount(makeCtx());
    expect(result.contractId).toBe(CONTRACT_ADDRESS);
    expect(result.deploymentStatus).toBe('unknown');
    expect(result.network).toBe('testnet');
  });

  it('uses smartAccountId from params when provided', async () => {
    const paramContractId = 'CDEF567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCD';
    mockGetOwner.mockResolvedValue('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');

    const result = await handleGetSmartAccount(
      makeCtx('https://dapp.example', { smartAccountId: paramContractId })
    );
    expect(result.contractId).toBe(paramContractId);
    expect(result.deploymentStatus).toBe('deployed');
  });

  it('returns not_deployed for host object not found errors', async () => {
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;
    mockGetOwner.mockRejectedValue(new Error('host object not found'));

    const result = await handleGetSmartAccount(makeCtx());
    expect(result.deploymentStatus).toBe('not_deployed');
  });

  it('returns not_deployed for unknown contract id errors', async () => {
    localStore['ancore_contract_address'] = CONTRACT_ADDRESS;
    mockGetOwner.mockRejectedValue(new Error('unknown contract id'));

    const result = await handleGetSmartAccount(makeCtx());
    expect(result.deploymentStatus).toBe('not_deployed');
  });
});


// ── Signing handlers (issue #1122, #1121) ─────────────────────────────────────

describe('handleSignTransaction', () => {
  it('validates xdr param and throws on missing xdr', async () => {
    await expect(handleSignTransaction(makeCtx('https://dapp.example', {}))).rejects.toThrow(/xdr/);
  });

  it('throws when xdr is empty string', async () => {
    await expect(
      handleSignTransaction(makeCtx('https://dapp.example', { xdr: '   ' }))
    ).rejects.toThrow(/xdr/);
  });

  it('throws when origin is not allowed', async () => {
    const { isAllowed } = await import('../allowlist');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    await expect(
      handleSignTransaction(makeCtx('https://evil.example', { xdr: 'AAAA' }))
    ).rejects.toThrow('Origin not allowed');
  });

  it('enqueues approval and returns signed result on approval', async () => {
    const { enqueueApproval, registerResponseCallbacks } = await import('../response-queue');
    const { openApprovalWindow } = await import('../../../approval-window');
    vi.mocked(registerResponseCallbacks).mockImplementation((_id, resolve) =>
      resolve({ signedXdr: 'SIGNED_XDR' })
    );
    const result = await handleSignTransaction(
      makeCtx('https://dapp.example', { xdr: 'AAAA', network: 'testnet' })
    );
    expect(enqueueApproval).toHaveBeenCalled();
    expect(openApprovalWindow).toHaveBeenCalled();
    expect(result).toEqual({ signedXdr: 'SIGNED_XDR' });
  });

  it('rejects when approval is rejected', async () => {
    const { registerResponseCallbacks } = await import('../response-queue');
    vi.mocked(registerResponseCallbacks).mockImplementation((_id, _resolve, reject) =>
      reject(new Error('User rejected'))
    );
    await expect(
      handleSignTransaction(makeCtx('https://dapp.example', { xdr: 'AAAA' }))
    ).rejects.toThrow('User rejected');
  });
});

describe('handleSignAuthEntry', () => {
  it('throws on missing authEntry', async () => {
    await expect(handleSignAuthEntry(makeCtx('https://dapp.example', {}))).rejects.toThrow(/authEntry/);
  });

  it('throws on invalid base64 authEntry', async () => {
    await expect(
      handleSignAuthEntry(makeCtx('https://dapp.example', { authEntry: '   ' }))
    ).rejects.toThrow(/authEntry/);
  });

  it('throws when origin not allowed', async () => {
    const { isAllowed } = await import('../allowlist');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    await expect(
      handleSignAuthEntry(
        makeCtx('https://evil.example', { authEntry: Buffer.from('valid').toString('base64') })
      )
    ).rejects.toThrow('Origin not allowed');
  });

  it('enqueues and returns signed auth entry on approval', async () => {
    const { enqueueApproval, registerResponseCallbacks } = await import('../response-queue');
    const { openApprovalWindow } = await import('../../../approval-window');
    vi.mocked(registerResponseCallbacks).mockImplementation((_id, resolve) =>
      resolve({ signedAuthEntry: 'SIGNED_ENTRY' })
    );
    const entry = Buffer.from('auth-entry-data').toString('base64');
    const result = await handleSignAuthEntry(
      makeCtx('https://dapp.example', { authEntry: entry })
    );
    expect(enqueueApproval).toHaveBeenCalled();
    expect(openApprovalWindow).toHaveBeenCalledWith(expect.any(String), 'sign-auth-entry');
    expect(result).toEqual({ signedAuthEntry: 'SIGNED_ENTRY' });
  });

  it('rejects when user rejects', async () => {
    const { registerResponseCallbacks } = await import('../response-queue');
    vi.mocked(registerResponseCallbacks).mockImplementation((_id, _resolve, reject) =>
      reject(new Error('User rejected'))
    );
    const entry = Buffer.from('auth').toString('base64');
    await expect(
      handleSignAuthEntry(makeCtx('https://dapp.example', { authEntry: entry }))
    ).rejects.toThrow('User rejected');
  });
});

describe('handleSignMessage', () => {
  it('throws on missing message', async () => {
    await expect(handleSignMessage(makeCtx('https://dapp.example', {}))).rejects.toThrow(/message/);
  });

  it('throws on empty message', async () => {
    await expect(
      handleSignMessage(makeCtx('https://dapp.example', { message: '   ' }))
    ).rejects.toThrow(/message/);
  });

  it('throws when origin not allowed', async () => {
    const { isAllowed } = await import('../allowlist');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    await expect(
      handleSignMessage(makeCtx('https://evil.example', { message: 'hello' }))
    ).rejects.toThrow('Origin not allowed');
  });

  it('enqueues and returns signature on approval', async () => {
    const { enqueueApproval, registerResponseCallbacks } = await import('../response-queue');
    const { openApprovalWindow } = await import('../../../approval-window');
    vi.mocked(registerResponseCallbacks).mockImplementation((_id, resolve) =>
      resolve({ signature: 'SIG123' })
    );
    const result = await handleSignMessage(
      makeCtx('https://dapp.example', { message: 'hello world' })
    );
    expect(enqueueApproval).toHaveBeenCalled();
    expect(openApprovalWindow).toHaveBeenCalled();
    expect(result).toEqual({ signature: 'SIG123' });
  });

  it('rejects when approval rejected', async () => {
    const { registerResponseCallbacks } = await import('../response-queue');
    vi.mocked(registerResponseCallbacks).mockImplementation((_id, _resolve, reject) =>
      reject(new Error('User rejected'))
    );
    await expect(
      handleSignMessage(makeCtx('https://dapp.example', { message: 'hello' }))
    ).rejects.toThrow('User rejected');
  });
});

describe('handleRequestSessionKey', () => {
  it('throws on missing expiresAt', async () => {
    await expect(
      handleRequestSessionKey(makeCtx('https://dapp.example', { permissions: 1 }))
    ).rejects.toThrow(/expiresAt/);
  });

  it('throws when expiresAt is not in future', async () => {
    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', { expiresAt: Date.now() - 1000, permissions: 1 })
      )
    ).rejects.toThrow(/future/);
  });

  it('throws on missing permissions', async () => {
    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', { expiresAt: Date.now() + 100000 })
      )
    ).rejects.toThrow(/permissions/);
  });

  it('throws when origin not allowed', async () => {
    const { isAllowed } = await import('../allowlist');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);
    await expect(
      handleRequestSessionKey(
        makeCtx('https://evil.example', { expiresAt: Date.now() + 100000, permissions: 1 })
      )
    ).rejects.toThrow('Origin not allowed');
  });

  it('returns session key material on success', async () => {
    const result = await handleRequestSessionKey(
      makeCtx('https://dapp.example', { expiresAt: Date.now() + 100000, permissions: 0b11 })
    );
    expect(result.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it('enqueues approval for session key request', async () => {
    const { enqueueApproval } = await import('../response-queue');
    await handleRequestSessionKey(
      makeCtx('https://dapp.example', { expiresAt: Date.now() + 100000, permissions: 1 })
    );
    expect(enqueueApproval).toHaveBeenCalled();
  });
});
