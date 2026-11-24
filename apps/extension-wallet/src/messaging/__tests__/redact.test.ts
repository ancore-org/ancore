import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REDACTED_VALUE, redactForLog } from '../redact';
import { sendMessage } from '../sender';

declare global {
  var chrome: unknown;
}

describe('redactForLog', () => {
  it('redacts top-level sensitive values', () => {
    const result = redactForLog('UNLOCK_WALLET', {
      password: 'hunter2',
      username: 'alice',
    });

    expect(result).toEqual({ password: REDACTED_VALUE, username: 'alice' });
  });

  it('redacts nested sensitive values', () => {
    const result = redactForLog('UNLOCK_WALLET', {
      outer: {
        password: 'nested-secret',
        inner: { mnemonic: 'word word word' },
      },
    });

    expect(result).toEqual({
      outer: {
        password: REDACTED_VALUE,
        inner: { mnemonic: REDACTED_VALUE },
      },
    });
  });

  it('redacts sensitive values inside arrays', () => {
    const result = redactForLog('UNLOCK_WALLET', {
      items: [{ password: 'one' }, { secret: 'two' }, { privateKey: 'three' }],
    });

    expect(result).toEqual({
      items: [
        { password: REDACTED_VALUE },
        { secret: REDACTED_VALUE },
        { privateKey: REDACTED_VALUE },
      ],
    });
  });

  it('does not mutate the original payload', () => {
    const payload = { password: 'keep-me', nested: { seed: 'also-keep' } };
    const snapshot = structuredClone(payload);

    redactForLog('UNLOCK_WALLET', payload);

    expect(payload).toEqual(snapshot);
  });

  it('redacts fields listed for a specific message type', () => {
    const result = redactForLog('EXTERNAL_SIGN_AUTH_ENTRY', {
      authEntry: 'SENSITIVE_AUTH_ENTRY',
      origin: 'https://dapp.example',
    });

    expect(result).toEqual({
      authEntry: REDACTED_VALUE,
      origin: 'https://dapp.example',
    });
  });

  it('handles circular references without throwing', () => {
    const payload: Record<string, unknown> = { password: 'hunter2' };
    payload.self = payload;

    const result = redactForLog('UNLOCK_WALLET', payload) as Record<string, unknown>;

    expect(result.password).toBe(REDACTED_VALUE);
    expect(result.self).toBe('<circular>');
  });

  it('redacts a shared object reached through sibling paths', () => {
    const shared = { note: 'shared' };
    const result = redactForLog('UNLOCK_WALLET', {
      first: shared,
      second: shared,
    }) as Record<string, Record<string, string>>;

    expect(result.first).toEqual({ note: 'shared' });
    expect(result.second).toEqual({ note: 'shared' });
  });

  it('passes primitives through unchanged', () => {
    expect(redactForLog('UNLOCK_WALLET', 'plain text')).toBe('plain text');
    expect(redactForLog('UNLOCK_WALLET', 42)).toBe(42);
    expect(redactForLog('UNLOCK_WALLET', null)).toBeNull();
  });
});

describe('sendMessage debug logging', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('DEV', true);
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    globalThis.chrome = {
      runtime: {
        sendMessage: vi.fn(
          (
            _message: unknown,
            callback: (response: { id: string; ok: boolean; payload: unknown }) => void
          ) => {
            Promise.resolve().then(() =>
              callback({ id: 'response-id', ok: true, payload: { success: true } })
            );
          }
        ),
        lastError: null,
      },
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('never logs the UNLOCK_WALLET password value', async () => {
    await sendMessage('UNLOCK_WALLET', { password: 'plaintext-password-123' });

    const logged = JSON.stringify(debugSpy.mock.calls);
    expect(logged).not.toContain('plaintext-password-123');
    expect(logged).toContain(REDACTED_VALUE);
  });
});
