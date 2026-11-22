/**
 * Unit tests for handleGetPublicKey, handleGetNetwork, and handleGetSmartAccount (#809, #960)
 */

import { Keypair, scValToNative, SorobanDataBuilder, StrKey, xdr } from '@stellar/stellar-sdk';
import { sessionKeyToScVal } from '@ancore/account-abstraction';
import { SessionPermission, type ExternalHandlerContext, type SessionKey } from '@ancore/types';
import { useSessionKeyStore } from '@/stores/sessionKeys';
import {
  handleGetPublicKey,
  handleGetNetwork,
  handleRequestAccess,
  handleGetSmartAccount,
  handleSignTransaction,
  handleSignAuthEntry,
  handleSignMessage,
  handleRequestSessionKey,
  queryRegisteredSessionKey,
  SessionKeyPolicyError,
} from '../handlers';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = 'CABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
const VALID_SMART_ACCOUNT_ID = StrKey.encodeContract(Buffer.alloc(32, 7));
const ALLOWED_TARGET_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 9));
const OWNER_KEYPAIR = Keypair.random();

const localStore: Record<string, unknown> = {};
let vaultUnlocked = true;
let vaultSessionKeys: Record<string, string> = {};
const mockSaveSessionKeys = vi.fn(async (data: { keys: Record<string, string> }) => {
  vaultSessionKeys = { ...data.keys };
});
const mockGetSessionKeys = vi.fn(async () => ({ keys: { ...vaultSessionKeys } }));

const mockLocalStorage = {
  get: vi.fn((key: string, cb: (result: Record<string, unknown>) => void) => {
    cb({ [key]: localStore[key] ?? null });
  }),
  set: vi.fn((data: Record<string, unknown>, cb?: () => void) => {
    Object.assign(localStore, data);
    cb?.();
  }),
  remove: vi.fn((key: string, cb?: () => void) => {
    delete localStore[key];
    cb?.();
  }),
};

vi.mock('@/stores/settings', () => ({
  getSettingsState: () => ({ network: 'testnet' }),
}));

vi.mock('@/security/storage-manager', () => ({
  getSharedStorageManager: () => ({
    get isUnlocked() {
      return vaultUnlocked;
    },
    getAccount: vi.fn(async () => (vaultUnlocked ? { privateKey: OWNER_KEYPAIR.secret() } : null)),
    getSessionKeys: (...args: unknown[]) => mockGetSessionKeys(...(args as [])),
    saveSessionKeys: (data: { keys: Record<string, string> }) => mockSaveSessionKeys(data),
  }),
}));

vi.mock('../../../session-state', () => ({
  clearUnlockSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../allowlist', () => ({
  isAllowed: vi.fn().mockResolvedValue(true),
  addToAllowlist: vi.fn(),
}));

vi.mock('../response-queue', () => ({
  enqueueApproval: vi.fn(),
  registerResponseCallbacks: vi.fn(),
  removeApproval: vi.fn(),
  writeSessionEntry: vi.fn(),
}));

vi.mock('../../../approval-window', () => ({
  openApprovalWindow: vi.fn().mockResolvedValue(undefined),
}));

// ── handleGetSmartAccount & Soroban RPC mocks ─────────────────────────────────

let mockGetOwner: ReturnType<typeof vi.fn>;
let mockRpcGetAccount: ReturnType<typeof vi.fn>;
let mockRpcSimulateTransaction: ReturnType<typeof vi.fn>;
let mockRpcSendTransaction: ReturnType<typeof vi.fn>;
let mockRpcGetTransaction: ReturnType<typeof vi.fn>;

vi.mock('@ancore/account-abstraction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ancore/account-abstraction')>();
  const { StrKey: SdkStrKey } = await import('@stellar/stellar-sdk');

  class MockableAccountContract extends actual.AccountContract {
    constructor(contractId: string) {
      const safeContractId = SdkStrKey.isValidContract(contractId)
        ? contractId
        : SdkStrKey.encodeContract(Buffer.alloc(32, 1));
      super(safeContractId);
    }

    override getOwner(
      ...args: Parameters<InstanceType<typeof actual.AccountContract>['getOwner']>
    ): Promise<string> {
      return mockGetOwner(...args);
    }
  }

  return {
    ...actual,
    AccountContract: vi
      .fn()
      .mockImplementation((contractId: string) => new MockableAccountContract(contractId)),
  };
});

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: vi.fn().mockImplementation(() => ({
        getAccount: (...args: unknown[]) => mockRpcGetAccount(...args),
        simulateTransaction: (...args: unknown[]) => mockRpcSimulateTransaction(...args),
        sendTransaction: (...args: unknown[]) => mockRpcSendTransaction(...args),
        getTransaction: (...args: unknown[]) => mockRpcGetTransaction(...args),
      })),
    },
  };
});

// Re-set globalThis.chrome in beforeEach because vitest.setup.ts deletes it
// before every test to prevent leakage between files.
beforeEach(() => {
  (globalThis as any).chrome = { storage: { local: mockLocalStorage } };
  Object.keys(localStore).forEach((k) => delete localStore[k]);
  vaultUnlocked = true;
  vaultSessionKeys = {};
  useSessionKeyStore.setState({ keys: [] });
  // Clears recorded calls on every mock (implementations are preserved) so
  // assertions like `not.toHaveBeenCalled()` don't see calls from prior tests.
  vi.clearAllMocks();
  mockGetOwner = vi.fn();
  mockRpcGetAccount = vi.fn(async (accountId: string) => ({
    accountId: () => accountId,
    sequenceNumber: () => '100',
  }));
  mockRpcSimulateTransaction = vi.fn();
  mockRpcSendTransaction = vi.fn();
  mockRpcGetTransaction = vi.fn();
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
    await expect(handleSignAuthEntry(makeCtx('https://dapp.example', {}))).rejects.toThrow(
      /authEntry/
    );
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
    const result = await handleSignAuthEntry(makeCtx('https://dapp.example', { authEntry: entry }));
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

describe('handleRequestSessionKey (#958)', () => {
  interface RecordedAddSessionKeyCall {
    publicKey: string;
    expiresAt: number;
    permissions: number[];
    allowedContracts: string[] | null;
    maxAmountPerCall: bigint | null;
    cumulativeLimit: bigint | null;
    spendWindowSeconds: number;
  }

  let onChainSessionKeys: Map<string, SessionKey>;
  let recordedContractCalls: RecordedAddSessionKeyCall[];
  let pendingAddCall: RecordedAddSessionKeyCall | null;

  beforeEach(async () => {
    localStore['ancore_contract_address'] = VALID_SMART_ACCOUNT_ID;
    onChainSessionKeys = new Map();
    recordedContractCalls = [];
    pendingAddCall = null;

    const { registerResponseCallbacks } = await import('../response-queue');
    vi.mocked(registerResponseCallbacks).mockImplementation((_id, resolve) =>
      resolve({ approved: true })
    );

    mockRpcSimulateTransaction.mockImplementation(async (tx: any) => {
      const invocation = tx.operations[0].func.invokeContract();
      const fnName = invocation.functionName().toString();
      const args: xdr.ScVal[] = invocation.args();

      if (fnName === 'add_session_key') {
        expect(args).toHaveLength(7);
        const pubKeyBytes = scValToNative(args[0]) as Uint8Array;
        const publicKey = StrKey.encodeEd25519PublicKey(Buffer.from(pubKeyBytes));
        const expiresAt = Number(scValToNative(args[1]));
        const permissions = (scValToNative(args[2]) as Array<number | bigint>).map(Number);
        const rawAllowed = scValToNative(args[3]);
        const allowedContracts = Array.isArray(rawAllowed) ? (rawAllowed as string[]) : null;
        const rawMax = scValToNative(args[4]);
        const maxAmountPerCall = rawMax != null ? BigInt(rawMax) : null;
        const rawCumulative = scValToNative(args[5]);
        const cumulativeLimit = rawCumulative != null ? BigInt(rawCumulative) : null;
        const spendWindowSeconds = Number(scValToNative(args[6]));

        pendingAddCall = {
          publicKey,
          expiresAt,
          permissions,
          allowedContracts,
          maxAmountPerCall,
          cumulativeLimit,
          spendWindowSeconds,
        };

        return {
          id: 'sim-add-session-key',
          latestLedger: 500,
          minResourceFee: '100',
          transactionData: new SorobanDataBuilder(),
          result: { auth: [], retval: xdr.ScVal.scvVoid() },
          _parsed: true,
        };
      }

      if (fnName === 'get_session_key') {
        expect(args).toHaveLength(1);
        const pubKeyBytes = scValToNative(args[0]) as Uint8Array;
        const publicKey = StrKey.encodeEd25519PublicKey(Buffer.from(pubKeyBytes));
        const stored = onChainSessionKeys.get(publicKey);
        return {
          id: 'sim-get-session-key',
          latestLedger: 501,
          minResourceFee: '100',
          result: {
            auth: [],
            retval: stored ? sessionKeyToScVal(stored) : xdr.ScVal.scvVoid(),
          },
        };
      }

      throw new Error(`Unexpected contract method in mock RPC: ${fnName}`);
    });

    mockRpcSendTransaction.mockImplementation(async (signedTx: any) => {
      expect(signedTx.signatures.length).toBeGreaterThan(0);
      const sig = signedTx.signatures[0].signature();
      expect(OWNER_KEYPAIR.verify(signedTx.hash(), sig)).toBe(true);

      if (pendingAddCall) {
        recordedContractCalls.push(pendingAddCall);
        onChainSessionKeys.set(pendingAddCall.publicKey, {
          publicKey: pendingAddCall.publicKey,
          expiresAt: pendingAddCall.expiresAt,
          permissions: pendingAddCall.permissions as SessionPermission[],
        });
        pendingAddCall = null;
      }

      return { status: 'PENDING', hash: 'tx-session-key-1' };
    });

    mockRpcGetTransaction.mockResolvedValue({ status: 'SUCCESS' });
  });

  it('throws typed SessionKeyPolicyError on missing expiresAt without opening approval popup', async () => {
    const { openApprovalWindow } = await import('../../../approval-window');

    await expect(
      handleRequestSessionKey(makeCtx('https://dapp.example', { permissions: 1 }))
    ).rejects.toMatchObject({
      name: 'SessionKeyPolicyError',
      code: 'INVALID_EXPIRES_AT',
      field: 'expiresAt',
    });
    expect(openApprovalWindow).not.toHaveBeenCalled();
  });

  it('throws typed SessionKeyPolicyError when expiresAt is not in future', async () => {
    const { openApprovalWindow } = await import('../../../approval-window');

    let caught: unknown;
    try {
      await handleRequestSessionKey(
        makeCtx('https://dapp.example', { expiresAt: Date.now() - 1000, permissions: 1 })
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SessionKeyPolicyError);
    expect((caught as Error).message).toMatch(/future/);
    expect(caught).toMatchObject({ code: 'EXPIRED', field: 'expiresAt' });
    expect(openApprovalWindow).not.toHaveBeenCalled();
  });

  it('throws typed SessionKeyPolicyError on missing, zero, or out-of-range permissions', async () => {
    const { openApprovalWindow } = await import('../../../approval-window');

    await expect(
      handleRequestSessionKey(makeCtx('https://dapp.example', { expiresAt: Date.now() + 100_000 }))
    ).rejects.toThrow(/permissions/);

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', { expiresAt: Date.now() + 100_000, permissions: 0 })
      )
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION', field: 'permissions' });

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', { expiresAt: Date.now() + 100_000, permissions: 0b1000 })
      )
    ).rejects.toMatchObject({ code: 'INVALID_PERMISSION', field: 'permissions' });

    expect(openApprovalWindow).not.toHaveBeenCalled();
  });

  it('throws typed SessionKeyPolicyError on invalid allowedContracts or spend limits', async () => {
    const { openApprovalWindow } = await import('../../../approval-window');
    const expiresAt = Date.now() + 100_000;

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', {
          expiresAt,
          permissions: 1,
          allowedContracts: ['CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
        })
      )
    ).rejects.toMatchObject({
      code: 'INVALID_ALLOWED_CONTRACTS',
      field: 'allowedContracts',
    });

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', {
          expiresAt,
          permissions: 1,
          maxAmountPerCall: '0',
        })
      )
    ).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
      field: 'maxAmountPerCall',
    });

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', {
          expiresAt,
          permissions: 1,
          cumulativeLimit: '5000',
        })
      )
    ).rejects.toMatchObject({
      code: 'INVALID_SPEND_WINDOW',
      field: 'spendWindowSeconds',
    });

    expect(openApprovalWindow).not.toHaveBeenCalled();
  });

  it('throws when wallet is not onboarded before opening approval popup', async () => {
    const { openApprovalWindow } = await import('../../../approval-window');
    delete localStore['ancore_contract_address'];

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', { expiresAt: Date.now() + 100_000, permissions: 1 })
      )
    ).rejects.toThrow('Wallet not set up');
    expect(openApprovalWindow).not.toHaveBeenCalled();
  });

  it('throws when origin is not allowlisted before opening approval popup', async () => {
    const { isAllowed } = await import('../allowlist');
    const { openApprovalWindow } = await import('../../../approval-window');
    vi.mocked(isAllowed).mockResolvedValueOnce(false);

    await expect(
      handleRequestSessionKey(
        makeCtx('https://evil.example', { expiresAt: Date.now() + 100_000, permissions: 1 })
      )
    ).rejects.toThrow('Origin not allowed');
    expect(openApprovalWindow).not.toHaveBeenCalled();
  });

  it('awaits user approval and rejects without on-chain call or store mutation when rejected', async () => {
    const { registerResponseCallbacks } = await import('../response-queue');
    vi.mocked(registerResponseCallbacks).mockImplementationOnce((_id, _resolve, reject) =>
      reject(new Error('User rejected the session key request'))
    );

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', { expiresAt: Date.now() + 100_000, permissions: 1 })
      )
    ).rejects.toThrow('User rejected the session key request');

    expect(mockRpcSimulateTransaction).not.toHaveBeenCalled();
    expect(mockRpcSendTransaction).not.toHaveBeenCalled();
    expect(useSessionKeyStore.getState().keys).toHaveLength(0);
    expect(mockSaveSessionKeys).not.toHaveBeenCalled();
  });

  it('derives a real Ed25519 keypair, registers policy on-chain via add_session_key, persists metadata, and is queryable via get_session_key', async () => {
    const { enqueueApproval } = await import('../response-queue');
    const { openApprovalWindow } = await import('../../../approval-window');
    const expiresAtMs = Math.floor((Date.now() + 3_600_000) / 1000) * 1000;
    const expectedExpiresAtSec = Math.floor(expiresAtMs / 1000);

    const result = await handleRequestSessionKey(
      makeCtx('https://dapp.example', {
        expiresAt: expiresAtMs,
        permissions: 0b101, // SEND_PAYMENT (0) + INVOKE_CONTRACT (2)
        allowedContracts: [ALLOWED_TARGET_CONTRACT_ID],
        maxAmountPerCall: '10000000',
        cumulativeLimit: '50000000',
        spendWindowSeconds: 86400,
      })
    );

    expect(StrKey.isValidEd25519PublicKey(result.publicKey)).toBe(true);
    expect(result.expiresAt).toBe(expiresAtMs);

    expect(enqueueApproval).toHaveBeenCalled();
    expect(openApprovalWindow).toHaveBeenCalledWith('test-req-id', 'request-session-key');

    expect(recordedContractCalls).toHaveLength(1);
    expect(recordedContractCalls[0]).toEqual({
      publicKey: result.publicKey,
      expiresAt: expectedExpiresAtSec,
      permissions: [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT],
      allowedContracts: [ALLOWED_TARGET_CONTRACT_ID],
      maxAmountPerCall: 10_000_000n,
      cumulativeLimit: 50_000_000n,
      spendWindowSeconds: 86400,
    });

    const onChainKey = await queryRegisteredSessionKey(result.publicKey);
    expect(onChainKey).toEqual({
      publicKey: result.publicKey,
      expiresAt: expectedExpiresAtSec,
      permissions: [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT],
    });

    const storedKeys = useSessionKeyStore.getState().keys;
    expect(storedKeys).toEqual([
      {
        publicKey: result.publicKey,
        permissions: [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT],
        expiresAt: expiresAtMs,
        label: 'https://dapp.example',
      },
    ]);
    expect(JSON.stringify(storedKeys)).not.toMatch(/"S[A-Z2-7]{55}"/);

    expect(mockSaveSessionKeys).toHaveBeenCalledTimes(1);
    const savedSecret = vaultSessionKeys[result.publicKey];
    expect(StrKey.isValidEd25519SecretSeed(savedSecret)).toBe(true);
    expect(Keypair.fromSecret(savedSecret).publicKey()).toBe(result.publicKey);
  });

  it('does not persist session key when on-chain transaction fails', async () => {
    mockRpcGetTransaction.mockResolvedValueOnce({ status: 'FAILED' });

    await expect(
      handleRequestSessionKey(
        makeCtx('https://dapp.example', {
          expiresAt: Date.now() + 100_000,
          permissions: 0b011,
        })
      )
    ).rejects.toThrow(/On-chain add_session_key transaction failed/);

    expect(useSessionKeyStore.getState().keys).toHaveLength(0);
    expect(mockSaveSessionKeys).not.toHaveBeenCalled();
  });
});
