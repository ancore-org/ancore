/**
 * Tests for service URL validation and health probing.
 * Issue #567
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateServiceUrl,
  validateServiceUrls,
  probeServiceHealth,
  probeAllServiceHealth,
  getCachedHealth,
  setCachedHealth,
  getConfigErrors,
  clearConfigErrors,
  isSendBlocked,
  resolveRelayerUrl,
  resolveIndexerUrl,
} from '../urls';

// ---------------------------------------------------------------------------
// validateServiceUrl
// ---------------------------------------------------------------------------

describe('validateServiceUrl', () => {
  it('accepts a valid https URL', () => {
    expect(validateServiceUrl('https://relayer.ancore.io', 'relayer')).toBeUndefined();
  });

  it('accepts a valid http URL (localhost)', () => {
    expect(validateServiceUrl('http://localhost:3000', 'relayer')).toBeUndefined();
  });

  it('rejects an empty string', () => {
    expect(validateServiceUrl('', 'relayer')).toMatch(/must not be empty/i);
  });

  it('rejects a whitespace-only string', () => {
    expect(validateServiceUrl('   ', 'relayer')).toMatch(/must not be empty/i);
  });

  it('rejects a non-URL string', () => {
    expect(validateServiceUrl('not-a-url', 'relayer')).toMatch(/not a valid URL/i);
  });

  it('rejects ftp:// scheme', () => {
    expect(validateServiceUrl('ftp://relayer.ancore.io', 'relayer')).toMatch(/http or https/i);
  });

  it('rejects ws:// scheme', () => {
    expect(validateServiceUrl('ws://relayer.ancore.io', 'relayer')).toMatch(/http or https/i);
  });

  it('includes the service name in the error message', () => {
    const err = validateServiceUrl('', 'indexer');
    expect(err).toMatch(/indexer/i);
  });
});

// ---------------------------------------------------------------------------
// validateServiceUrls
// ---------------------------------------------------------------------------

describe('validateServiceUrls', () => {
  it('returns empty array when both URLs are valid', () => {
    expect(
      validateServiceUrls({
        relayerUrl: 'https://relayer.ancore.io',
        indexerUrl: 'https://indexer.ancore.io',
      })
    ).toEqual([]);
  });

  it('returns one error when only relayer URL is invalid', () => {
    const errors = validateServiceUrls({
      relayerUrl: 'bad-url',
      indexerUrl: 'https://indexer.ancore.io',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/relayer/i);
  });

  it('returns two errors when both URLs are invalid', () => {
    const errors = validateServiceUrls({
      relayerUrl: '',
      indexerUrl: 'ftp://bad',
    });
    expect(errors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// probeServiceHealth — mocked fetch
// ---------------------------------------------------------------------------

describe('probeServiceHealth', () => {
  beforeEach(() => {
    clearConfigErrors();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns ok when /health responds 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    );

    const result = await probeServiceHealth('https://relayer.ancore.io', 'relayer');
    expect(result.status).toBe('ok');
    expect(result.service).toBe('relayer');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns degraded when /health responds 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('error', { status: 500 }));

    const result = await probeServiceHealth('https://relayer.ancore.io', 'relayer');
    expect(result.status).toBe('degraded');
    expect(result.reason).toMatch(/500/);
  });

  it('returns degraded when /health responds 503', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('unavailable', { status: 503 }));

    const result = await probeServiceHealth('https://relayer.ancore.io', 'relayer');
    expect(result.status).toBe('degraded');
  });

  it('returns unreachable on network error (CORS/fetch failure)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await probeServiceHealth('https://relayer.ancore.io', 'relayer');
    expect(result.status).toBe('unreachable');
    expect(result.reason).toMatch(/Failed to fetch/i);
  });

  it('returns unreachable on timeout (AbortError)', async () => {
    // Simulate fetch rejecting with an AbortError (as the browser does when AbortController fires)
    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })
    );

    const result = await probeServiceHealth('https://relayer.ancore.io', 'relayer', 5000);
    expect(result.status).toBe('unreachable');
    expect(result.reason).toMatch(/timed out/i);
  });

  it('returns unreachable immediately for invalid URL without fetching', async () => {
    const result = await probeServiceHealth('not-a-url', 'relayer');
    expect(result.status).toBe('unreachable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('probes the /health path on the given base URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await probeServiceHealth('https://relayer.ancore.io', 'relayer');
    expect(fetch).toHaveBeenCalledWith(
      'https://relayer.ancore.io/health',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('strips trailing slash before appending /health', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await probeServiceHealth('https://relayer.ancore.io/', 'relayer');
    expect(fetch).toHaveBeenCalledWith('https://relayer.ancore.io/health', expect.anything());
  });
});

// ---------------------------------------------------------------------------
// probeAllServiceHealth
// ---------------------------------------------------------------------------

describe('probeAllServiceHealth', () => {
  beforeEach(() => {
    clearConfigErrors();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns results for both services', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const results = await probeAllServiceHealth({
      relayerUrl: 'https://relayer.ancore.io',
      indexerUrl: 'https://indexer.ancore.io',
    });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.service)).toContain('relayer');
    expect(results.map((r) => r.service)).toContain('indexer');
  });
});

// ---------------------------------------------------------------------------
// Health cache and config errors
// ---------------------------------------------------------------------------

describe('health cache', () => {
  beforeEach(() => clearConfigErrors());

  it('returns unchecked for a service that has not been probed', () => {
    expect(getCachedHealth('relayer').status).toBe('unchecked');
  });

  it('caches a health result', () => {
    setCachedHealth({ service: 'relayer', status: 'ok', latencyMs: 42 });
    expect(getCachedHealth('relayer').status).toBe('ok');
  });

  it('adds a config error when status is unreachable', () => {
    setCachedHealth({ service: 'relayer', status: 'unreachable', reason: 'timeout' });
    const errors = getConfigErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe('RELAYER_UNREACHABLE');
  });

  it('clears config error when service recovers', () => {
    setCachedHealth({ service: 'relayer', status: 'unreachable', reason: 'timeout' });
    setCachedHealth({ service: 'relayer', status: 'ok', latencyMs: 10 });
    expect(getConfigErrors()).toHaveLength(0);
  });

  it('clearConfigErrors resets all state', () => {
    setCachedHealth({ service: 'relayer', status: 'unreachable', reason: 'timeout' });
    clearConfigErrors();
    expect(getConfigErrors()).toHaveLength(0);
    expect(getCachedHealth('relayer').status).toBe('unchecked');
  });
});

// ---------------------------------------------------------------------------
// isSendBlocked
// ---------------------------------------------------------------------------

describe('isSendBlocked', () => {
  beforeEach(() => clearConfigErrors());

  it('returns false when relayer is ok', () => {
    setCachedHealth({ service: 'relayer', status: 'ok' });
    expect(isSendBlocked()).toBe(false);
  });

  it('returns true when relayer is unreachable', () => {
    setCachedHealth({ service: 'relayer', status: 'unreachable' });
    expect(isSendBlocked()).toBe(true);
  });

  it('returns false when relayer is degraded (non-blocking)', () => {
    setCachedHealth({ service: 'relayer', status: 'degraded' });
    expect(isSendBlocked()).toBe(false);
  });

  it('returns false when relayer has not been checked yet', () => {
    expect(isSendBlocked()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// URL resolution helpers
// ---------------------------------------------------------------------------

describe('resolveRelayerUrl', () => {
  it('returns production URL for production environment', () => {
    expect(resolveRelayerUrl('production')).toMatch(/^https?:\/\//);
  });

  it('returns staging URL for staging environment', () => {
    expect(resolveRelayerUrl('staging')).toMatch(/staging/i);
  });

  it('falls back to production for unknown environment', () => {
    const prod = resolveRelayerUrl('production');
    expect(resolveRelayerUrl('unknown-env')).toBe(prod);
  });
});

describe('resolveIndexerUrl', () => {
  it('returns production URL for production environment', () => {
    expect(resolveIndexerUrl('production')).toMatch(/^https?:\/\//);
  });

  it('returns staging URL for staging environment', () => {
    expect(resolveIndexerUrl('staging')).toMatch(/staging/i);
  });
});
