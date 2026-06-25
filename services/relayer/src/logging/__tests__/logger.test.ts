/**
 * Tests for the structured relayer logger.
 * Validates log object shape, redaction, and child logger bindings.
 *
 * Issue #474
 */

import { rootLogger, createRequestLogger, redactAccountId, redactSessionKey } from '../logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function captureLog(level: 'debug' | 'info' | 'warn' | 'error', fn: () => void): unknown {
  const spy = jest.spyOn(console, level).mockImplementation(() => undefined);
  fn();
  const call = spy.mock.calls[0]?.[0];
  spy.mockRestore();
  return call;
}

// ---------------------------------------------------------------------------
// redactAccountId
// ---------------------------------------------------------------------------

describe('redactAccountId', () => {
  it('returns undefined for falsy input', () => {
    expect(redactAccountId(undefined)).toBeUndefined();
    expect(redactAccountId('')).toBeUndefined();
  });

  it('returns the full value when 8 chars or fewer', () => {
    expect(redactAccountId('GBXXX123')).toBe('GBXXX123');
  });

  it('truncates to first 8 chars + ellipsis for longer values', () => {
    expect(redactAccountId('GBXXX123YYYY')).toBe('GBXXX123\u2026');
  });
});

// ---------------------------------------------------------------------------
// redactSessionKey
// ---------------------------------------------------------------------------

describe('redactSessionKey', () => {
  it('returns undefined for falsy input', () => {
    expect(redactSessionKey(undefined)).toBeUndefined();
    expect(redactSessionKey('')).toBeUndefined();
  });

  it('returns the full value when 8 chars or fewer', () => {
    expect(redactSessionKey('abcd1234')).toBe('abcd1234');
  });

  it('truncates to first 8 chars + ellipsis for longer values', () => {
    const key = 'a'.repeat(64);
    expect(redactSessionKey(key)).toBe('aaaaaaaa\u2026');
  });
});

// ---------------------------------------------------------------------------
// rootLogger — stable log object shape
// ---------------------------------------------------------------------------

describe('rootLogger', () => {
  it('emits an object with stable keys: level, service, message, timestamp', () => {
    const entry = captureLog('info', () => {
      rootLogger.info({}, 'test_event');
    }) as Record<string, unknown>;

    expect(entry).toMatchObject({
      level: 'info',
      service: 'relayer',
      message: 'test_event',
    });
    expect(typeof entry['timestamp']).toBe('string');
  });

  it('merges extra fields into the log entry', () => {
    const entry = captureLog('info', () => {
      rootLogger.info({ durationMs: 42, outcome: 'success' }, 'relay_execute_complete');
    }) as Record<string, unknown>;

    expect(entry['durationMs']).toBe(42);
    expect(entry['outcome']).toBe('success');
  });

  it('emits warn level correctly', () => {
    const entry = captureLog('warn', () => {
      rootLogger.warn({ statusCode: 422 }, 'relay_validate_failed');
    }) as Record<string, unknown>;

    expect(entry['level']).toBe('warn');
    expect(entry['statusCode']).toBe(422);
  });

  it('emits error level correctly', () => {
    const entry = captureLog('error', () => {
      rootLogger.error({ errorCode: 'INTERNAL_ERROR' }, 'unhandled_error');
    }) as Record<string, unknown>;

    expect(entry['level']).toBe('error');
  });

  it('redacts known sensitive keys', () => {
    const entry = captureLog('info', () => {
      rootLogger.info(
        { token: 'super-secret', authorization: 'Bearer xyz', durationMs: 10 },
        'should_redact'
      );
    }) as Record<string, unknown>;

    expect(entry['token']).toBe('[REDACTED]');
    expect(entry['authorization']).toBe('[REDACTED]');
    expect(entry['durationMs']).toBe(10);
  });

  it('does not log raw auth payloads', () => {
    const entry = captureLog('info', () => {
      rootLogger.info({ auth: 'Bearer secret123', password: 'hunter2' }, 'auth_event');
    }) as Record<string, unknown>;

    expect(entry['auth']).toBe('[REDACTED]');
    expect(entry['password']).toBe('[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// child logger — bindings propagation
// ---------------------------------------------------------------------------

describe('child logger', () => {
  it('inherits parent bindings', () => {
    const child = rootLogger.child({ requestId: 'req-abc', route: 'POST /relay/execute' });
    const entry = captureLog('info', () => {
      child.info({ durationMs: 5 }, 'child_event');
    }) as Record<string, unknown>;

    expect(entry['requestId']).toBe('req-abc');
    expect(entry['route']).toBe('POST /relay/execute');
    expect(entry['durationMs']).toBe(5);
  });

  it('child fields override parent bindings', () => {
    const parent = rootLogger.child({ requestId: 'parent-id' });
    const child = parent.child({ requestId: 'child-id' });
    const entry = captureLog('info', () => {
      child.info({}, 'override_test');
    }) as Record<string, unknown>;

    expect(entry['requestId']).toBe('child-id');
  });

  it('does not mutate parent bindings', () => {
    const parent = rootLogger.child({ requestId: 'parent-id' });
    parent.child({ requestId: 'child-id' });

    const entry = captureLog('info', () => {
      parent.info({}, 'parent_event');
    }) as Record<string, unknown>;

    expect(entry['requestId']).toBe('parent-id');
  });
});

// ---------------------------------------------------------------------------
// createRequestLogger
// ---------------------------------------------------------------------------

describe('createRequestLogger', () => {
  it('creates a logger with route and requestId bound', () => {
    const log = createRequestLogger({
      requestId: 'req-xyz',
      route: 'POST /relay/validate',
    });

    const entry = captureLog('info', () => {
      log.info({ durationMs: 12, outcome: 'success' }, 'relay_validate_complete');
    }) as Record<string, unknown>;

    expect(entry['requestId']).toBe('req-xyz');
    expect(entry['route']).toBe('POST /relay/validate');
    expect(entry['durationMs']).toBe(12);
    expect(entry['outcome']).toBe('success');
  });

  it('redacts accountId to first 8 chars', () => {
    const log = createRequestLogger({
      route: 'POST /relay/execute',
      accountId: 'GBXXX123LONGACCOUNTID',
    });

    const entry = captureLog('info', () => {
      log.info({}, 'test');
    }) as Record<string, unknown>;

    expect(entry['accountId']).toBe('GBXXX123\u2026');
  });

  it('redacts sessionKey to first 8 chars', () => {
    const log = createRequestLogger({
      route: 'POST /relay/execute',
      sessionKey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });

    const entry = captureLog('info', () => {
      log.info({}, 'test');
    }) as Record<string, unknown>;

    expect(entry['sessionKey']).toBe('abcdef12\u2026');
  });

  it('omits accountId when not provided', () => {
    const log = createRequestLogger({ route: 'POST /relay/execute' });
    const entry = captureLog('info', () => {
      log.info({}, 'test');
    }) as Record<string, unknown>;

    expect(entry['accountId']).toBeUndefined();
  });
});
