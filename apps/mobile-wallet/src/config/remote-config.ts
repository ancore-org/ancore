export interface RemoteAppConfig {
  minimumAppVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  updateUrl?: string;
}

export type AppGateResult =
  | { status: 'ok' }
  | { status: 'force-update'; minimumAppVersion: string; updateUrl?: string }
  | { status: 'maintenance'; message?: string };

export class RemoteConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteConfigError';
  }
}

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export const parseSemver = (version: string): [number, number, number] => {
  const match = SEMVER_PATTERN.exec(version.trim());

  if (!match) {
    throw new RemoteConfigError(
      `Invalid semver version "${version}". Expected MAJOR.MINOR.PATCH (optionally prefixed with "v").`
    );
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/** Compare two semver strings. Returns -1 when a < b, 0 when equal, 1 when a > b. */
export const compareSemver = (a: string, b: string): -1 | 0 | 1 => {
  const left = parseSemver(a);
  const right = parseSemver(b);

  for (let i = 0; i < 3; i += 1) {
    if (left[i] < right[i]) {
      return -1;
    }
    if (left[i] > right[i]) {
      return 1;
    }
  }

  return 0;
};

export const isVersionBelowMinimum = (current: string, minimum: string): boolean => {
  return compareSemver(current, minimum) < 0;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const optionalString = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new RemoteConfigError(`Remote config field "${field}" must be a string.`);
  }

  return value.trim() || undefined;
};

export const parseRemoteAppConfig = (input: unknown): RemoteAppConfig => {
  if (!isRecord(input)) {
    throw new RemoteConfigError('Remote config payload must be a JSON object.');
  }

  if (typeof input.minimumAppVersion !== 'string') {
    throw new RemoteConfigError('Remote config field "minimumAppVersion" must be a string.');
  }

  parseSemver(input.minimumAppVersion);

  if (typeof input.maintenanceMode !== 'boolean') {
    throw new RemoteConfigError('Remote config field "maintenanceMode" must be a boolean.');
  }

  return {
    minimumAppVersion: input.minimumAppVersion,
    maintenanceMode: input.maintenanceMode,
    maintenanceMessage: optionalString(input.maintenanceMessage, 'maintenanceMessage'),
    updateUrl: optionalString(input.updateUrl, 'updateUrl'),
  };
};

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * How long the startup gate waits for the config host before giving up.
 *
 * This runs before the user can do anything, so the ceiling is what a person
 * will tolerate staring at a launch screen, not what a request might
 * eventually achieve. Five seconds is long enough for a slow mobile network
 * and short enough that a dead host is indistinguishable from a fast one.
 */
export const REMOTE_CONFIG_TIMEOUT_MS = 5_000;

/**
 * Fetch and validate the remote config.
 *
 * The timeout is what makes `checkAppGate`'s fail-open guarantee real (#1352).
 * That guarantee — "an unreachable config host must never brick the wallet" —
 * rests entirely on the fetch eventually rejecting, and a stalled TCP
 * connection does not reject: it just sits there. A clean failure was always
 * handled; a half-open connection would have held the startup gate open for as
 * long as the platform's own socket timeout, which is minutes.
 *
 * A timeout is deliberately raised as an ordinary `RemoteConfigError`, so the
 * existing catch-all in `checkAppGate` treats it exactly like any other
 * failure and lets the user through.
 */
export const fetchRemoteAppConfig = async (
  url: string,
  fetchFn: FetchLike = fetch,
  timeoutMs: number = REMOTE_CONFIG_TIMEOUT_MS
): Promise<RemoteAppConfig> => {
  const controller = new AbortController();
  const timeoutError = () =>
    new RemoteConfigError(`Remote config request timed out after ${timeoutMs}ms.`);

  let timer: ReturnType<typeof setTimeout> | undefined;
  // Rejects when time is up. It is raced against the request below rather than relying
  // on `fetchFn` to honour the abort signal: a polyfill that ignores it would otherwise
  // leave startup hanging exactly as if there were no timeout (#1618).
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError());
    }, timeoutMs);
  });

  const request = (async () => {
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) {
      throw new RemoteConfigError(`Remote config request failed with status ${response.status}.`);
    }
    // Still inside the timed section: headers can arrive and the body then stall on a
    // degraded connection, which must not hang startup either.
    return parseRemoteAppConfig(await response.json());
  })();

  try {
    return await Promise.race([request, timedOut]);
  } catch (error) {
    // `AbortError` is the signal firing; anything else is a genuine failure. A timeout
    // and a network failure are reported the same way — the caller's only sensible
    // reaction to either is to proceed without a config.
    if (error instanceof Error && error.name === 'AbortError') {
      throw timeoutError();
    }
    throw error;
  } finally {
    // Always cleared, on success and on every failure: a timer left pending keeps the
    // process alive for the full duration and, on React Native, shows up as a warning
    // about an unhandled timer.
    clearTimeout(timer);
  }
};

export interface EvaluateAppGateOptions {
  config: RemoteAppConfig;
  appVersion: string;
  /** Dev-only escape hatch so local builds are never blocked by the gate. */
  bypass?: boolean;
}

export const evaluateAppGate = ({
  config,
  appVersion,
  bypass,
}: EvaluateAppGateOptions): AppGateResult => {
  if (bypass) {
    return { status: 'ok' };
  }

  if (config.maintenanceMode) {
    return { status: 'maintenance', message: config.maintenanceMessage };
  }

  if (isVersionBelowMinimum(appVersion, config.minimumAppVersion)) {
    return {
      status: 'force-update',
      minimumAppVersion: config.minimumAppVersion,
      updateUrl: config.updateUrl,
    };
  }

  return { status: 'ok' };
};

export interface CheckAppGateOptions {
  configUrl?: string;
  appVersion?: string;
  bypass?: boolean;
  fetchFn?: FetchLike;
  /** Overrides `REMOTE_CONFIG_TIMEOUT_MS`; mainly for tests. */
  timeoutMs?: number;
}

/**
 * Fetch the remote config and evaluate the gate. Fails open: when the config
 * URL is not set, the fetch fails or times out, or the payload is malformed,
 * the app is allowed through — an unreachable config host must never brick the
 * wallet.
 *
 * The bound on "unreachable" is `fetchRemoteAppConfig`'s timeout. Without it
 * this promise could stay pending indefinitely on a stalled connection, and
 * failing open only helps if the failure actually arrives (#1352).
 */
export const checkAppGate = async ({
  configUrl,
  appVersion,
  bypass,
  fetchFn,
  timeoutMs,
}: CheckAppGateOptions): Promise<AppGateResult> => {
  if (!configUrl || !appVersion || bypass) {
    return { status: 'ok' };
  }

  try {
    const config = await fetchRemoteAppConfig(configUrl, fetchFn, timeoutMs);
    return evaluateAppGate({ config, appVersion, bypass });
  } catch {
    // Includes the timeout above: a config host that hangs is treated exactly
    // like one that refuses the connection.
    return { status: 'ok' };
  }
};
