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
  url: string
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export const fetchRemoteAppConfig = async (
  url: string,
  fetchFn: FetchLike = fetch
): Promise<RemoteAppConfig> => {
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new RemoteConfigError(`Remote config request failed with status ${response.status}.`);
  }

  return parseRemoteAppConfig(await response.json());
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
}

/**
 * Fetch the remote config and evaluate the gate. Fails open: when the config
 * URL is not set, the fetch fails, or the payload is malformed, the app is
 * allowed through — an unreachable config host must never brick the wallet.
 */
export const checkAppGate = async ({
  configUrl,
  appVersion,
  bypass,
  fetchFn,
}: CheckAppGateOptions): Promise<AppGateResult> => {
  if (!configUrl || !appVersion || bypass) {
    return { status: 'ok' };
  }

  try {
    const config = await fetchRemoteAppConfig(configUrl, fetchFn);
    return evaluateAppGate({ config, appVersion, bypass });
  } catch {
    return { status: 'ok' };
  }
};
