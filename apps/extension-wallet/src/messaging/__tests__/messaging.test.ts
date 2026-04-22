/**
 * Messaging System Tests
 *
 * Unit tests for:
 * - sendMessage — success, handler error, timeout, runtime error, no response
 * - registerHandler / unregisterHandler — registry behaviour
 * - installMessageDispatcher — listener installation guard
 * - Message dispatch — correct handler invoked, error forwarded
 *
 * Integration tests for the full popup → background → popup round-trip.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendMessage } from '../sender';
import {
  registerHandler,
  unregisterHandler,
  installMessageDispatcher,
  _resetHandlers,
} from '../handler';
import type { MessageEnvelope, ResponseEnvelope } from '../types';

// Allow tests to set the chrome global (the module-level `declare const chrome`
// declarations in sender.ts / handler.ts resolve to globalThis.chrome at runtime).
declare global {
  var chrome: unknown;
}

// ---------------------------------------------------------------------------
// Chrome mock helpers
// ---------------------------------------------------------------------------

/**
 * Captured listener installed by installMessageDispatcher.
 * Tests hold a reference so they can deliver messages directly.
 */
type OnMessageCallback = (
  message: unknown,
  sender: object,
  sendResponse: (response: ResponseEnvelope) => void
) => boolean | void;

let capturedListener: OnMessageCallback | null = null;

type ChromeMock = ReturnType<typeof buildChromeMock>;

function buildChromeMock(
  options: {
    /** Response the sendMessage callback will receive. Pass undefined to simulate no response. */
    response?: ResponseEnvelope;
    /** Simulate chrome.runtime.lastError */
    lastError?: { message: string };
  } = {}
) {
  return {
    runtime: {
      sendMessage: vi.fn((_msg: MessageEnvelope, callback: (r: ResponseEnvelope) => void) => {
        // Deliver the response asynchronously (mirrors real Chrome behaviour).
        Promise.resolve().then(() => callback(options.response as ResponseEnvelope));
      }),
      get lastError() {
        return options.lastError ?? null;
      },
      onMessage: {
        addListener: vi.fn((cb: OnMessageCallback) => {
          capturedListener = cb;
        }),
      },
    },
  };
}

function setChrome(mock: ChromeMock): void {
  globalThis.chrome = mock;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedListener = null;
  _resetHandlers();
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// sendMessage — unit tests
// ---------------------------------------------------------------------------

describe('sendMessage', () => {
  it('resolves with the response payload on success', async () => {
    const mockResponse: ResponseEnvelope = {
      id: '1',
      ok: true,
      payload: { balance: '100.00' },
    };

    setChrome(buildChromeMock({ response: mockResponse }));

    const result = await sendMessage('GET_BALANCE', { publicKey: 'GABC123' });
    expect(result).toEqual({ balance: '100.00' });
  });

  it('rejects when the handler responds with ok: false', async () => {
    const mockResponse: ResponseEnvelope = {
      id: '1',
      ok: false,
      error: 'Account not found',
    };

    setChrome(buildChromeMock({ response: mockResponse }));

    await expect(sendMessage('GET_BALANCE', { publicKey: 'GABC123' })).rejects.toThrow(
      'Account not found'
    );
  });

  it('rejects with a generic message when ok: false and no error string', async () => {
    const mockResponse: ResponseEnvelope = { id: '1', ok: false };

    setChrome(buildChromeMock({ response: mockResponse }));

    await expect(sendMessage('GET_BALANCE', { publicKey: 'GABC123' })).rejects.toThrow(
      /Handler rejected/
    );
  });

  it('rejects when chrome.runtime.lastError is set', async () => {
    const mockResponse: ResponseEnvelope = { id: '1', ok: true, payload: { balance: '0' } };

    setChrome(
      buildChromeMock({
        response: mockResponse,
        lastError: { message: 'Could not establish connection' },
      })
    );

    await expect(sendMessage('GET_BALANCE', { publicKey: 'GABC123' })).rejects.toThrow(
      'Could not establish connection'
    );
  });

  it('rejects when no response is received (undefined callback arg)', async () => {
    setChrome(buildChromeMock({ response: undefined }));

    await expect(sendMessage('GET_BALANCE', { publicKey: 'GABC123' })).rejects.toThrow(
      /No response received/
    );
  });

  it('rejects after the specified timeout', async () => {
    // sendMessage callback is never called — simulate a hanging background.
    globalThis.chrome = {
      runtime: { sendMessage: vi.fn(), lastError: null },
    };

    await expect(
      sendMessage('GET_BALANCE', { publicKey: 'GABC123' }, { timeoutMs: 50 })
    ).rejects.toThrow(/Timeout/);
  }, 500);

  it('includes the timeout duration in the rejection message', async () => {
    globalThis.chrome = {
      runtime: { sendMessage: vi.fn(), lastError: null },
    };

    await expect(
      sendMessage('GET_BALANCE', { publicKey: 'GABC123' }, { timeoutMs: 50 })
    ).rejects.toThrow(/50 ms/);
  }, 500);

  it('sends an envelope with the correct type and payload', async () => {
    const mockResponse: ResponseEnvelope = { id: '1', ok: true, payload: { txId: 'TX123' } };
    const chromeMock = buildChromeMock({ response: mockResponse });
    setChrome(chromeMock);

    await sendMessage('SEND_TRANSACTION', { to: 'GBOB', amount: '50' });

    const sentEnvelope = chromeMock.runtime.sendMessage.mock.calls[0][0] as MessageEnvelope;
    expect(sentEnvelope.type).toBe('SEND_TRANSACTION');
    expect(sentEnvelope.payload).toEqual({ to: 'GBOB', amount: '50' });
    expect(typeof sentEnvelope.id).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// registerHandler / unregisterHandler — unit tests
// ---------------------------------------------------------------------------

describe('registerHandler / unregisterHandler', () => {
  it('registers a handler without throwing', () => {
    expect(() => {
      registerHandler('GET_BALANCE', async () => ({ balance: '42' }));
    }).not.toThrow();
  });

  it('overwrites a previously registered handler for the same type', async () => {
    registerHandler('GET_BALANCE', async () => ({ balance: 'first' }));
    registerHandler('GET_BALANCE', async () => ({ balance: 'second' }));

    setChrome(buildChromeMock());
    installMessageDispatcher();

    const envelope: MessageEnvelope = {
      type: 'GET_BALANCE',
      id: 'test-1',
      payload: { publicKey: 'GABC' },
    };

    await new Promise<void>((resolve) => {
      capturedListener!(envelope, {}, (response) => {
        expect(response.payload).toEqual({ balance: 'second' });
        resolve();
      });
    });
  });

  it('unregisterHandler prevents the handler from being called', async () => {
    registerHandler('LOCK_WALLET', async () => ({ success: true }));
    unregisterHandler('LOCK_WALLET');

    setChrome(buildChromeMock());
    installMessageDispatcher();

    const envelope: MessageEnvelope = {
      type: 'LOCK_WALLET',
      id: 'test-2',
      payload: {},
    };

    const sendResponse = vi.fn();
    const result = capturedListener!(envelope, {}, sendResponse);

    expect(result).toBeUndefined();
    await Promise.resolve(); // flush microtasks
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// installMessageDispatcher — unit tests
// ---------------------------------------------------------------------------

describe('installMessageDispatcher', () => {
  it('registers a listener on chrome.runtime.onMessage', () => {
    const chromeMock = buildChromeMock();
    setChrome(chromeMock);

    installMessageDispatcher();

    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce();
  });

  it('is idempotent — calling it twice adds the listener only once', () => {
    const chromeMock = buildChromeMock();
    setChrome(chromeMock);

    installMessageDispatcher();
    installMessageDispatcher();

    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalledOnce();
  });

  it('ignores messages that do not conform to the envelope schema', () => {
    setChrome(buildChromeMock());
    installMessageDispatcher();

    const sendResponse = vi.fn();

    expect(capturedListener!('ping', {}, sendResponse)).toBeUndefined();
    expect(capturedListener!({ type: 'GET_BALANCE' }, {}, sendResponse)).toBeUndefined();
    expect(capturedListener!({ id: '1' }, {}, sendResponse)).toBeUndefined();

    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('ignores messages with an unregistered type', async () => {
    setChrome(buildChromeMock());
    installMessageDispatcher();

    const sendResponse = vi.fn();
    const result = capturedListener!(
      { type: 'UNKNOWN_TYPE', id: 'x', payload: {} },
      {},
      sendResponse
    );

    expect(result).toBeUndefined();
    await Promise.resolve();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Dispatcher — handler invocation unit tests
// ---------------------------------------------------------------------------

describe('dispatcher — handler invocation', () => {
  beforeEach(() => {
    setChrome(buildChromeMock());
    installMessageDispatcher();
  });

  it('calls the registered handler with the request payload', async () => {
    const handler = vi.fn(async () => ({ balance: '99' }));
    registerHandler('GET_BALANCE', handler);

    const envelope: MessageEnvelope = {
      type: 'GET_BALANCE',
      id: 'inv-1',
      payload: { publicKey: 'GTEST' },
    };

    await new Promise<void>((resolve) => {
      capturedListener!(envelope, {}, () => resolve());
    });

    expect(handler).toHaveBeenCalledWith({ publicKey: 'GTEST' });
  });

  it('sends ok: true with the handler result', async () => {
    registerHandler('LOCK_WALLET', async () => ({ success: true }));

    const envelope: MessageEnvelope = {
      type: 'LOCK_WALLET',
      id: 'inv-2',
      payload: {},
    };

    const response = await new Promise<ResponseEnvelope>((resolve) => {
      capturedListener!(envelope, {}, resolve);
    });

    expect(response.ok).toBe(true);
    expect(response.payload).toEqual({ success: true });
    expect(response.id).toBe('inv-2');
  });

  it('sends ok: false when the handler throws an Error', async () => {
    registerHandler('GET_BALANCE', async () => {
      throw new Error('Stellar node unreachable');
    });

    const envelope: MessageEnvelope = {
      type: 'GET_BALANCE',
      id: 'inv-3',
      payload: { publicKey: 'GERR' },
    };

    const response = await new Promise<ResponseEnvelope>((resolve) => {
      capturedListener!(envelope, {}, resolve);
    });

    expect(response.ok).toBe(false);
    expect(response.error).toBe('Stellar node unreachable');
    expect(response.id).toBe('inv-3');
  });

  it('handles a non-Error thrown value gracefully', async () => {
    registerHandler('LOCK_WALLET', async () => {
      throw 'string rejection';
    });

    const envelope: MessageEnvelope = {
      type: 'LOCK_WALLET',
      id: 'inv-4',
      payload: {},
    };

    const response = await new Promise<ResponseEnvelope>((resolve) => {
      capturedListener!(envelope, {}, resolve);
    });

    expect(response.ok).toBe(false);
    expect(response.error).toBe('string rejection');
  });

  it('returns true from the listener to keep the message channel open', () => {
    registerHandler('GET_BALANCE', async () => ({ balance: '0' }));

    const envelope: MessageEnvelope = {
      type: 'GET_BALANCE',
      id: 'inv-5',
      payload: { publicKey: 'GASYNC' },
    };

    const result = capturedListener!(envelope, {}, vi.fn());
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — full popup → background → popup round-trip
// ---------------------------------------------------------------------------

describe('integration — full round-trip', () => {
  /**
   * Wire sendMessage to the captured listener directly, simulating
   * the two-context message flow without needing real browser contexts.
   */
  function wireContexts(): void {
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn((envelope: MessageEnvelope, callback: (r: ResponseEnvelope) => void) => {
          Promise.resolve().then(() => {
            if (capturedListener) {
              capturedListener(envelope, {}, callback);
            } else {
              callback(undefined as unknown as ResponseEnvelope);
            }
          });
        }),
        get lastError() {
          return null;
        },
        onMessage: {
          addListener: vi.fn((cb: OnMessageCallback) => {
            capturedListener = cb;
          }),
        },
      },
    };
  }

  beforeEach(() => {
    wireContexts();
    installMessageDispatcher();
  });

  it('GET_BALANCE: popup receives the balance returned by the background handler', async () => {
    registerHandler('GET_BALANCE', async ({ publicKey }) => {
      expect(publicKey).toBe('GABC123');
      return { balance: '250.50' };
    });

    const result = await sendMessage('GET_BALANCE', { publicKey: 'GABC123' });
    expect(result).toEqual({ balance: '250.50' });
  });

  it('SEND_TRANSACTION: popup receives the txId from the background handler', async () => {
    registerHandler('SEND_TRANSACTION', async ({ to, amount }) => {
      expect(to).toBe('GBOB456');
      expect(amount).toBe('10');
      return { txId: 'TX_DEADBEEF' };
    });

    const result = await sendMessage('SEND_TRANSACTION', { to: 'GBOB456', amount: '10' });
    expect(result).toEqual({ txId: 'TX_DEADBEEF' });
  });

  it('SIGN_TRANSACTION: returns signed XDR', async () => {
    registerHandler('SIGN_TRANSACTION', async ({ xdr }) => ({
      signedXdr: `signed:${xdr}`,
    }));

    const result = await sendMessage('SIGN_TRANSACTION', { xdr: 'AAAA...BASE64' });
    expect(result.signedXdr).toBe('signed:AAAA...BASE64');
  });

  it('GET_WALLET_STATE: returns the current wallet state', async () => {
    registerHandler('GET_WALLET_STATE', async () => ({ state: 'unlocked' }));

    const result = await sendMessage('GET_WALLET_STATE', {});
    expect(result.state).toBe('unlocked');
  });

  it('UNLOCK_WALLET: returns success flag based on password', async () => {
    registerHandler('UNLOCK_WALLET', async ({ password }) => ({
      success: password === 'correct-password',
    }));

    const ok = await sendMessage('UNLOCK_WALLET', { password: 'correct-password' });
    expect(ok.success).toBe(true);

    const fail = await sendMessage('UNLOCK_WALLET', { password: 'wrong' });
    expect(fail.success).toBe(false);
  });

  it('propagates handler errors back to the sender as rejected promises', async () => {
    registerHandler('GET_BALANCE', async () => {
      throw new Error('Node offline');
    });

    await expect(sendMessage('GET_BALANCE', { publicKey: 'GFAIL' })).rejects.toThrow(
      'Node offline'
    );
  });

  it('multiple concurrent requests are all resolved independently', async () => {
    registerHandler('GET_BALANCE', async ({ publicKey }) => ({ balance: publicKey }));

    const [a, b, c] = await Promise.all([
      sendMessage('GET_BALANCE', { publicKey: 'A' }),
      sendMessage('GET_BALANCE', { publicKey: 'B' }),
      sendMessage('GET_BALANCE', { publicKey: 'C' }),
    ]);

    expect(a.balance).toBe('A');
    expect(b.balance).toBe('B');
    expect(c.balance).toBe('C');
  });
});
