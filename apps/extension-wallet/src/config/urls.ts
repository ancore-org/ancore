/**
 * Service URL Configuration and Validation
 *
 * Provides synchronous URL format validation and async health probing
 * for the relayer and indexer services. Results are cached so the UI
 * and send-flow gate can read them without re-fetching.
 *
 * Issue #567
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceName = 'relayer' | 'indexer';

export type ServiceHealthStatus = 'ok' | 'degraded' | 'unreachable' | 'unchecked';

export interface ServiceUrlConfig {
  relayerUrl: string;
  indexerUrl: string;
}

export interface ServiceHealthResult {
  service: ServiceName;
  status: ServiceHealthStatus;
  /** Round-trip latency in ms, present when status is 'ok' or 'degraded' */
  latencyMs?: number;
  /** Human-readable reason for non-ok status */
  reason?: string;
}

export type ConfigErrorCode = 'RELAYER_UNREACHABLE' | 'INDEXER_UNREACHABLE' | 'INVALID_URL';

export interface ConfigError {
  code: ConfigErrorCode;
  service: ServiceName;
  message: string;
}

// ---------------------------------------------------------------------------
// Environment-to-URL mapping
// ---------------------------------------------------------------------------

const RELAYER_URLS: Record<string, string> = {
  production:
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_RELAYER_URL
      ? import.meta.env.VITE_RELAYER_URL
      : 'https://relayer.ancore.io',
  staging: 'https://relayer-staging.ancore.io',
  local: 'http://localhost:3000',
};

const INDEXER_URLS: Record<string, string> = {
  production: 'https://indexer.ancore.io',
  staging: 'https://indexer-staging.ancore.io',
  local: 'http://localhost:4000',
};

export function resolveRelayerUrl(environment: string): string {
  return RELAYER_URLS[environment] ?? RELAYER_URLS['production']!;
}

export function resolveIndexerUrl(environment: string): string {
  return INDEXER_URLS[environment] ?? INDEXER_URLS['production']!;
}

// ---------------------------------------------------------------------------
// Synchronous URL format validation
// ---------------------------------------------------------------------------

const ALLOWED_SCHEMES = ['http:', 'https:'];

/**
 * Validates a URL string synchronously.
 * Rejects non-http(s) schemes, empty strings, and malformed URLs.
 *
 * @returns An error message string if invalid, undefined if valid.
 */
export function validateServiceUrl(url: string, service: ServiceName): string | undefined {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return `${service} URL must not be empty`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return `${service} URL is not a valid URL: "${url}"`;
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return `${service} URL must use http or https scheme, got "${parsed.protocol}"`;
  }

  if (!parsed.hostname || parsed.hostname.trim().length === 0) {
    return `${service} URL must include a valid hostname`;
  }

  return undefined;
}

/**
 * Validates both relayer and indexer URLs synchronously.
 * Returns an array of error messages (empty if all valid).
 */
export function validateServiceUrls(config: ServiceUrlConfig): string[] {
  const errors: string[] = [];

  const relayerError = validateServiceUrl(config.relayerUrl, 'relayer');
  if (relayerError) errors.push(relayerError);

  const indexerError = validateServiceUrl(config.indexerUrl, 'indexer');
  if (indexerError) errors.push(indexerError);

  return errors;
}

// ---------------------------------------------------------------------------
// Async health probing
// ---------------------------------------------------------------------------

const HEALTH_PROBE_TIMEOUT_MS = 5_000;

/**
 * Probes a single service's /health endpoint.
 * Handles timeout, 5xx responses, and CORS/network errors gracefully.
 */
export async function probeServiceHealth(
  url: string,
  service: ServiceName,
  timeoutMs: number = HEALTH_PROBE_TIMEOUT_MS
): Promise<ServiceHealthResult> {
  const formatError = validateServiceUrl(url, service);
  if (formatError) {
    return { service, status: 'unreachable', reason: formatError };
  }

  const healthUrl = `${url.replace(/\/$/, '')}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const latencyMs = Date.now() - start;

    if (response.ok) {
      return { service, status: 'ok', latencyMs };
    }

    if (response.status >= 500) {
      return {
        service,
        status: 'degraded',
        latencyMs,
        reason: `Server returned HTTP ${response.status}`,
      };
    }

    // 4xx from /health is still reachable — treat as degraded
    return {
      service,
      status: 'degraded',
      latencyMs,
      reason: `Unexpected HTTP ${response.status} from health endpoint`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        service,
        status: 'unreachable',
        latencyMs,
        reason: `Health probe timed out after ${timeoutMs}ms`,
      };
    }
    // CORS / network error
    const reason = err instanceof Error ? err.message : 'Network error';
    return { service, status: 'unreachable', latencyMs, reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probes both relayer and indexer health endpoints concurrently.
 */
export async function probeAllServiceHealth(
  config: ServiceUrlConfig,
  timeoutMs?: number
): Promise<ServiceHealthResult[]> {
  return Promise.all([
    probeServiceHealth(config.relayerUrl, 'relayer', timeoutMs),
    probeServiceHealth(config.indexerUrl, 'indexer', timeoutMs),
  ]);
}

// ---------------------------------------------------------------------------
// In-memory health cache (shared across popup and background contexts)
// ---------------------------------------------------------------------------

const _healthCache = new Map<ServiceName, ServiceHealthResult>();
const _configErrors = new Map<ServiceName, ConfigError>();

export function getCachedHealth(service: ServiceName): ServiceHealthResult {
  return _healthCache.get(service) ?? { service, status: 'unchecked' };
}

export function setCachedHealth(result: ServiceHealthResult): void {
  _healthCache.set(result.service, result);

  if (result.status === 'unreachable') {
    const code: ConfigErrorCode =
      result.service === 'relayer' ? 'RELAYER_UNREACHABLE' : 'INDEXER_UNREACHABLE';
    _configErrors.set(result.service, {
      code,
      service: result.service,
      message: result.reason ?? `${result.service} is unreachable`,
    });
  } else {
    _configErrors.delete(result.service);
  }
}

export function getConfigErrors(): ConfigError[] {
  return Array.from(_configErrors.values());
}

export function clearConfigErrors(): void {
  _configErrors.clear();
  _healthCache.clear();
}

/**
 * Returns true when the send flow should be blocked.
 * Blocked when relayer is unreachable (indexer degraded is non-blocking).
 */
export function isSendBlocked(): boolean {
  const relayerHealth = getCachedHealth('relayer');
  return relayerHealth.status === 'unreachable';
}
