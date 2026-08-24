/**
 * Background service-worker handler tests.
 *
 * Strategy: each test uses vi.resetModules() + dynamic import() to re-execute
 * the service-worker module fresh, resetting the module-level _sessionUnlocked
 * flag without touching production code.
 *
 * The chrome API is mocked on globalThis before every import so the module
 * picks it up at load time.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import type { MessageEnvelope, ResponseEnvelope } from '../../../messaging/types';
import type { AuthState } from '../../../router/AuthGuard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnMessageListener = (
  message: unknown,
  sender: object,
  sendResponse: (r: ResponseEnvelope) => void
) => boolean | void;

interface ChromeMock {
  runtime: {
    getManifest: ReturnType<typeof vi.fn>;
    onInstalled: { addListener: ReturnType<typeof vi.fn> };
    onStartup: { addListener: ReturnType<typeof vi.fn> };
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      _trigger: (msg: unknown, sender: object, respond: (r: ResponseEnvelope) => void) => void;
    };
  };
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
    session: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };
}

// ---------------------------------------------------------------------------
// Chrome mock factory
// ---------------------------------------------------------------------------

function buildChromeMock(): ChromeMock {
  const capturedListeners: OnMessageListener[] = [];
  const sessionStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};

  const mock: ChromeMock = {
    runtime: {
      getManifest: vi.fn(() => ({ name: 'ancore-extension-wallet', version: '0.0.0' })),
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((fn: OnMessageListener) => {
          capturedListeners.push(fn);
        }),
        _trigger(msg, sender, respond) {
          if (capturedListeners.length === 0) throw new Error('No onMessage listener installed');
          for (const listener of capturedListeners) {
            const result = listener(msg, sender, respond);
            if (result === true) break;
          }
        },
      },
    },
    storage: {
      local: {
        get: vi.fn((key: string | string[], cb: (r: Record<string, unknown>) => void) => {
          if (typeof key === 'string') {
            cb({ [key]: localStore[key] });
          } else {
            const result: Record<string, unknown> = {};
            for (const k of key) {
              result[k] = localStore[k];
            }
            cb(result);
          }
        }),
        set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
          Object.assign(localStore, items);
          cb?.();
        }),
      },
      session: {
        get: vi.fn((key: string, cb: (r: Record<string, unknown>) => void) =>
          cb({ [key]: sessionStore[key] })
        ),
        set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
          Object.assign(sessionStore, items);
          cb?.();
        }),
        remove: vi.fn((key: string, cb?: () => void) => {
          delete sessionStore[key];
          cb?.();
        }),
      },
    },
  };

  return mock;
}

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

function dispatch(
  chrome: ChromeMock,
  type: string,
  payload: unknown = {}
): Promise<ResponseEnvelope> {
  return new Promise((resolve) => {
    const envelope: MessageEnvelope = {
      type: type as any,
      id: `test-${Math.random().toString(36).slice(2)}`,
      payload,
    };
    chrome.runtime.onMessage._trigger(envelope, {}, resolve);
  });
}

// ---------------------------------------------------------------------------
// Per-test reset
// ---------------------------------------------------------------------------

let chromeMock: ChromeMock;

function makeAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    hasOnboarded: false,
    walletName: 'Test Wallet',
    accountAddress: 'GCFX...WALLET',
    ...overrides,
  };
}

async function loadServiceWorker(
  authState: AuthState,
  options: { unlockReturns?: boolean; signingSecret?: string } = {}
) {
  vi.doMock('@/router/AuthGuard', () => ({
    readAuthState: vi.fn(() => authState),
    DEFAULT_AUTH_STATE: makeAuthState(),
    AUTH_STORAGE_KEY: 'ancore_extension_auth',
  }));

  vi.doMock('@/security/storage-manager', () => ({
    getSharedStorageManager: vi.fn(() => ({
      unlock: vi.fn(async () => options.unlockReturns ?? true),
      lock: vi.fn(),
      getAccount: vi.fn(async () => ({ privateKey: options.signingSecret })),
    })),
    resetSharedStorageManagerForTests: vi.fn(),
  }));

  vi.doMock('@/messaging', async () => {
    const actual = await vi.importActual<typeof import('@/messaging')>('@/messaging');
    return actual;
  });

  // Re-import the service-worker — re-registers handlers with fresh module state.
  await import('../service-worker');

  // Also import _resetHandlers so we can clean up after
  const { _resetHandlers } = await import('@/messaging/handler');
  return { _resetHandlers };
}

beforeEach(() => {
  vi.resetModules();
  chromeMock = buildChromeMock();
  (globalThis as any).chrome = chromeMock;
  localStorage.clear();
});

afterEach(() => {
  delete (globalThis as any).chrome;
});

// ---------------------------------------------------------------------------
// GET_WALLET_STATE
// ---------------------------------------------------------------------------

describe('GET_WALLET_STATE', () => {
  it('returns uninitialized when the wallet has not onboarded', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: false }));

    const resp = await dispatch(chromeMock, 'GET_WALLET_STATE');

    expect(resp.ok).toBe(true);
    expect((resp.payload as any).state).toBe('uninitialized');
    _resetHandlers();
  });

  it('returns locked when onboarded but session is locked', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    const resp = await dispatch(chromeMock, 'GET_WALLET_STATE');

    expect(resp.ok).toBe(true);
    expect((resp.payload as any).state).toBe('locked');
    _resetHandlers();
  });

  it('returns unlocked after a successful UNLOCK_WALLET call', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'correct-password' });
    const resp = await dispatch(chromeMock, 'GET_WALLET_STATE');

    expect((resp.payload as any).state).toBe('unlocked');
    _resetHandlers();
  });
});

// ---------------------------------------------------------------------------
// LOCK_WALLET
// ---------------------------------------------------------------------------

describe('LOCK_WALLET', () => {
  it('returns success: true', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    const resp = await dispatch(chromeMock, 'LOCK_WALLET');

    expect(resp.ok).toBe(true);
    expect((resp.payload as any).success).toBe(true);
    _resetHandlers();
  });

  it('sets session to locked so GET_WALLET_STATE reflects it', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    // Unlock first
    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'any' });
    let stateResp = await dispatch(chromeMock, 'GET_WALLET_STATE');
    expect((stateResp.payload as any).state).toBe('unlocked');

    // Now lock
    await dispatch(chromeMock, 'LOCK_WALLET');
    stateResp = await dispatch(chromeMock, 'GET_WALLET_STATE');
    expect((stateResp.payload as any).state).toBe('locked');
    _resetHandlers();
  });
});

// ---------------------------------------------------------------------------
// UNLOCK_WALLET
// ---------------------------------------------------------------------------

describe('UNLOCK_WALLET', () => {
  it('returns failure when no password field is provided', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', {});

    expect((resp.payload as any).success).toBe(false);
    _resetHandlers();
  });

  it('returns failure when password is an empty string', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: '' });

    expect((resp.payload as any).success).toBe(false);
    _resetHandlers();
  });

  it('returns failure when password is not a string', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 12345 });

    expect((resp.payload as any).success).toBe(false);
    _resetHandlers();
  });

  it('returns failure when wallet has not been onboarded', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: false }));

    const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'any-password' });

    expect((resp.payload as any).success).toBe(false);
    _resetHandlers();
  });

  it('returns success when password is valid and wallet is onboarded', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'valid-password' });

    expect(resp.ok).toBe(true);
    expect((resp.payload as any).success).toBe(true);
    _resetHandlers();
  });

  it('keeps session locked after a failed unlock attempt', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: '' });
    const stateResp = await dispatch(chromeMock, 'GET_WALLET_STATE');

    expect((stateResp.payload as any).state).toBe('locked');
    _resetHandlers();
  });

  it('full cycle: unlock → state unlocked → lock → state locked', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'secret' });
    let stateResp = await dispatch(chromeMock, 'GET_WALLET_STATE');
    expect((stateResp.payload as any).state).toBe('unlocked');

    await dispatch(chromeMock, 'LOCK_WALLET');
    stateResp = await dispatch(chromeMock, 'GET_WALLET_STATE');
    expect((stateResp.payload as any).state).toBe('locked');
    _resetHandlers();
  });

  it('resets session flag when chrome.storage.set throws during unlock', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    // Make storage.set fail
    chromeMock.storage.local.set.mockImplementation(() => {
      throw new Error('storage quota exceeded');
    });

    const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'any' });

    // Handler catches the error — returns failure
    expect((resp.payload as any).success).toBe(false);

    // Session must remain locked after storage error
    // Restore storage mock to allow GET_WALLET_STATE to work
    chromeMock.storage.local.set.mockImplementation(
      (_items: Record<string, unknown>, cb?: () => void) => cb?.()
    );
    const stateResp = await dispatch(chromeMock, 'GET_WALLET_STATE');
    expect((stateResp.payload as any).state).toBe('locked');
    _resetHandlers();
  });

  it('returns failure when chrome.storage.set throws during lock', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'any' });

    chromeMock.storage.local.set.mockImplementation(() => {
      throw new Error('storage full');
    });

    const resp = await dispatch(chromeMock, 'LOCK_WALLET');

    expect((resp.payload as any).success).toBe(false);
    _resetHandlers();
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns retryAfterMs after repeated failed password attempts', async () => {
      const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }), {
        unlockReturns: false,
      });

      for (let i = 0; i < 5; i += 1) {
        await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'wrong-password' });
      }

      const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'wrong-password' });

      expect((resp.payload as any).success).toBe(false);
      expect((resp.payload as any).retryAfterMs).toBeGreaterThan(0);
      expect((resp.payload as any).message).toContain('Try again in');
      _resetHandlers();
    });

    it('rejects unlock attempts during lockout without verifying password', async () => {
      const unlock = vi.fn(async () => false);
      vi.doMock('@/security/storage-manager', () => ({
        getSharedStorageManager: vi.fn(() => ({
          unlock,
          lock: vi.fn(),
        })),
        resetSharedStorageManagerForTests: vi.fn(),
      }));
      vi.doMock('@/router/AuthGuard', () => ({
        readAuthState: vi.fn(() => makeAuthState({ hasOnboarded: true })),
        DEFAULT_AUTH_STATE: makeAuthState(),
        AUTH_STORAGE_KEY: 'ancore_extension_auth',
      }));
      vi.doMock('@/messaging', async () => {
        const actual = await vi.importActual<typeof import('@/messaging')>('@/messaging');
        return actual;
      });
      await import('../service-worker');
      const { _resetHandlers } = await import('@/messaging/handler');

      for (let i = 0; i < 5; i += 1) {
        await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'wrong-password' });
      }
      unlock.mockClear();

      const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'wrong-password' });

      expect((resp.payload as any).retryAfterMs).toBeGreaterThan(0);
      expect(unlock).not.toHaveBeenCalled();
      _resetHandlers();
    });

    it('resets the failure counter after a successful unlock', async () => {
      let unlockResult = false;
      const unlock = vi.fn(async () => unlockResult);
      vi.doMock('@/security/storage-manager', () => ({
        getSharedStorageManager: vi.fn(() => ({
          unlock,
          lock: vi.fn(),
        })),
        resetSharedStorageManagerForTests: vi.fn(),
      }));
      vi.doMock('@/router/AuthGuard', () => ({
        readAuthState: vi.fn(() => makeAuthState({ hasOnboarded: true })),
        DEFAULT_AUTH_STATE: makeAuthState(),
        AUTH_STORAGE_KEY: 'ancore_extension_auth',
      }));
      vi.doMock('@/messaging', async () => {
        const actual = await vi.importActual<typeof import('@/messaging')>('@/messaging');
        return actual;
      });
      await import('../service-worker');
      const { _resetHandlers } = await import('@/messaging/handler');

      for (let i = 0; i < 3; i += 1) {
        await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'wrong-password' });
      }

      unlockResult = true;
      const successResp = await dispatch(chromeMock, 'UNLOCK_WALLET', {
        password: 'correct-password',
      });
      expect((successResp.payload as any).success).toBe(true);

      unlockResult = false;
      for (let i = 0; i < 4; i += 1) {
        const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'wrong-password' });
        expect((resp.payload as any).retryAfterMs).toBeUndefined();
      }
      _resetHandlers();
    });

    it('allows unlock again after lockout expires', async () => {
      let unlockResult = false;
      const unlock = vi.fn(async () => unlockResult);
      vi.doMock('@/security/storage-manager', () => ({
        getSharedStorageManager: vi.fn(() => ({
          unlock,
          lock: vi.fn(),
        })),
        resetSharedStorageManagerForTests: vi.fn(),
      }));
      vi.doMock('@/router/AuthGuard', () => ({
        readAuthState: vi.fn(() => makeAuthState({ hasOnboarded: true })),
        DEFAULT_AUTH_STATE: makeAuthState(),
        AUTH_STORAGE_KEY: 'ancore_extension_auth',
      }));
      vi.doMock('@/messaging', async () => {
        const actual = await vi.importActual<typeof import('@/messaging')>('@/messaging');
        return actual;
      });
      await import('../service-worker');
      const { _resetHandlers } = await import('@/messaging/handler');

      for (let i = 0; i < 5; i += 1) {
        await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'wrong-password' });
      }

      vi.advanceTimersByTime(61_000);
      unlockResult = true;

      const resp = await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'correct-password' });
      expect((resp.payload as any).success).toBe(true);
      _resetHandlers();
    });
  });
});

// ---------------------------------------------------------------------------
// APPROVE_SIGN_REQUEST (dApp-facing sign/message bridge — issue #1213)
// ---------------------------------------------------------------------------

function approveSignRequest(
  chrome: ChromeMock,
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.onMessage._trigger(
      { type: 'APPROVE_SIGN_REQUEST', requestId },
      {},
      resolve as any
    );
  });
}

describe('APPROVE_SIGN_REQUEST', () => {
  it('resolves a SIGN_TRANSACTION approval with a real, cryptographically signed XDR — not the old hardcoded fake', async () => {
    const kp = Keypair.random();
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }), {
      signingSecret: kp.secret(),
    });
    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'any' });

    const { enqueueApproval, registerResponseCallbacks } =
      await import('../handlers/external/response-queue');
    const { Account, TransactionBuilder, Networks } = await import('@stellar/stellar-sdk');
    const tx = new TransactionBuilder(new Account(kp.publicKey(), '1'), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .setTimeout(0)
      .build();
    const xdr = tx.toXDR();

    const requestId = 'req-sign-tx-1';
    enqueueApproval(requestId, 'https://dapp.example', 'signTransaction', {
      xdr,
      networkPassphrase: Networks.TESTNET,
    });
    const waited = new Promise((resolve, reject) => {
      registerResponseCallbacks(requestId, resolve, reject);
    });

    const ack = await approveSignRequest(chromeMock, requestId);
    expect(ack.ok).toBe(true);

    const result = (await waited) as { signedXdr?: string };
    expect(result.signedXdr).toBeDefined();
    expect(result.signedXdr).not.toEqual('AAAAAgAAAAA=');
    expect(result.signedXdr).not.toEqual(xdr);
    _resetHandlers();
  });

  it('resolves a SIGN_MESSAGE approval with a real, verifiable Ed25519 signature', async () => {
    const kp = Keypair.random();
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }), {
      signingSecret: kp.secret(),
    });
    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'any' });

    const { enqueueApproval, registerResponseCallbacks } =
      await import('../handlers/external/response-queue');

    const message = '7b2273657373696f6e4b6579223a223078227d';
    const requestId = 'req-sign-msg-1';
    enqueueApproval(requestId, 'https://dapp.example', 'signMessage', { message });
    const waited = new Promise((resolve, reject) => {
      registerResponseCallbacks(requestId, resolve, reject);
    });

    const ack = await approveSignRequest(chromeMock, requestId);
    expect(ack.ok).toBe(true);

    const result = (await waited) as { signature?: string };
    expect(result.signature).toMatch(/^[0-9a-f]{128}$/);
    expect(kp.verify(Buffer.from(message, 'utf8'), Buffer.from(result.signature!, 'hex'))).toBe(
      true
    );
    _resetHandlers();
  });

  it('resolves a SIGN_RELAY_PAYLOAD approval with a real sessionKey + signature (issue #1213)', async () => {
    const kp = Keypair.random();
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }), {
      signingSecret: kp.secret(),
    });
    await dispatch(chromeMock, 'UNLOCK_WALLET', { password: 'any' });

    const { enqueueApproval, registerResponseCallbacks } =
      await import('../handlers/external/response-queue');
    const { buildRelayCanonicalPayload } = await import('@ancore/core-sdk');

    const requestId = 'req-sign-relay-1';
    enqueueApproval(requestId, 'https://dapp.example', 'signRelayPayload', {
      operation: 'relay_execute',
      nonce: 99,
    });
    const waited = new Promise((resolve, reject) => {
      registerResponseCallbacks(requestId, resolve, reject);
    });

    const ack = await approveSignRequest(chromeMock, requestId);
    expect(ack.ok).toBe(true);

    const result = (await waited) as { sessionKey?: string; signature?: string };
    expect(result.sessionKey).not.toEqual('a'.repeat(64));
    expect(result.signature).not.toEqual('b'.repeat(128));
    expect(result.sessionKey).toMatch(/^[0-9a-f]{64}$/);
    expect(result.signature).toMatch(/^[0-9a-f]{128}$/);

    const canonicalPayload = buildRelayCanonicalPayload({
      sessionKey: result.sessionKey!,
      operation: 'relay_execute',
      nonce: 99,
    });
    expect(
      kp.verify(Buffer.from(canonicalPayload, 'utf8'), Buffer.from(result.signature!, 'hex'))
    ).toBe(true);
    _resetHandlers();
  });

  it('rejects when no matching approval is pending', async () => {
    const { _resetHandlers } = await loadServiceWorker(makeAuthState({ hasOnboarded: true }));

    const ack = await approveSignRequest(chromeMock, 'unknown-request-id');

    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/not found/i);
    _resetHandlers();
  });
});
