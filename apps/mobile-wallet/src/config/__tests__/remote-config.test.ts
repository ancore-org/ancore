import {
  RemoteConfigError,
  checkAppGate,
  compareSemver,
  evaluateAppGate,
  fetchRemoteAppConfig,
  isVersionBelowMinimum,
  parseRemoteAppConfig,
  parseSemver,
  type FetchLike,
  type RemoteAppConfig,
} from '../remote-config';

const baseConfig: RemoteAppConfig = {
  minimumAppVersion: '1.2.0',
  maintenanceMode: false,
};

const fetchReturning = (payload: unknown, ok = true, status = 200): FetchLike => {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(payload),
  });
};

describe('parseSemver', () => {
  it('parses MAJOR.MINOR.PATCH into numeric parts', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('0.0.1')).toEqual([0, 0, 1]);
    expect(parseSemver('10.20.30')).toEqual([10, 20, 30]);
  });

  it('accepts a leading "v" and ignores prerelease/build suffixes', () => {
    expect(parseSemver('v2.1.0')).toEqual([2, 1, 0]);
    expect(parseSemver('1.2.3-beta.1')).toEqual([1, 2, 3]);
    expect(parseSemver('1.2.3+build.42')).toEqual([1, 2, 3]);
  });

  it('throws RemoteConfigError on malformed versions', () => {
    expect(() => parseSemver('1.2')).toThrow(RemoteConfigError);
    expect(() => parseSemver('not-a-version')).toThrow(RemoteConfigError);
    expect(() => parseSemver('')).toThrow(RemoteConfigError);
    expect(() => parseSemver('1.2.x')).toThrow(RemoteConfigError);
  });
});

describe('compareSemver', () => {
  it('compares major versions first', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.9.9', '2.0.0')).toBe(-1);
  });

  it('compares minor versions when majors are equal', () => {
    expect(compareSemver('1.3.0', '1.2.9')).toBe(1);
    expect(compareSemver('1.2.9', '1.3.0')).toBe(-1);
  });

  it('compares patch versions when major and minor are equal', () => {
    expect(compareSemver('1.2.3', '1.2.2')).toBe(1);
    expect(compareSemver('1.2.2', '1.2.3')).toBe(-1);
  });

  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
  });

  it('compares numerically, not lexicographically', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
    expect(compareSemver('0.2.10', '0.2.9')).toBe(1);
  });
});

describe('isVersionBelowMinimum', () => {
  it('is true only when the current version is strictly below the minimum', () => {
    expect(isVersionBelowMinimum('1.1.9', '1.2.0')).toBe(true);
    expect(isVersionBelowMinimum('1.2.0', '1.2.0')).toBe(false);
    expect(isVersionBelowMinimum('1.2.1', '1.2.0')).toBe(false);
  });
});

describe('parseRemoteAppConfig', () => {
  it('parses a valid payload', () => {
    expect(
      parseRemoteAppConfig({
        minimumAppVersion: '1.2.0',
        maintenanceMode: true,
        maintenanceMessage: 'Back soon',
        updateUrl: 'https://example.com/update',
      })
    ).toEqual({
      minimumAppVersion: '1.2.0',
      maintenanceMode: true,
      maintenanceMessage: 'Back soon',
      updateUrl: 'https://example.com/update',
    });
  });

  it('rejects non-object payloads', () => {
    expect(() => parseRemoteAppConfig(null)).toThrow(RemoteConfigError);
    expect(() => parseRemoteAppConfig([])).toThrow(RemoteConfigError);
    expect(() => parseRemoteAppConfig('1.2.0')).toThrow(RemoteConfigError);
  });

  it('rejects missing or invalid required fields', () => {
    expect(() => parseRemoteAppConfig({ maintenanceMode: false })).toThrow(RemoteConfigError);
    expect(() =>
      parseRemoteAppConfig({ minimumAppVersion: 'nope', maintenanceMode: false })
    ).toThrow(RemoteConfigError);
    expect(() =>
      parseRemoteAppConfig({ minimumAppVersion: '1.2.0', maintenanceMode: 'yes' })
    ).toThrow(RemoteConfigError);
  });

  it('drops empty optional strings', () => {
    const config = parseRemoteAppConfig({
      minimumAppVersion: '1.2.0',
      maintenanceMode: false,
      maintenanceMessage: '   ',
    });

    expect(config.maintenanceMessage).toBeUndefined();
  });
});

describe('fetchRemoteAppConfig', () => {
  it('fetches and parses the hosted config', async () => {
    const fetchFn = fetchReturning({ minimumAppVersion: '1.2.0', maintenanceMode: false });

    await expect(
      fetchRemoteAppConfig('https://config.example.com/app.json', fetchFn)
    ).resolves.toEqual(baseConfig);
    expect(fetchFn).toHaveBeenCalledWith('https://config.example.com/app.json');
  });

  it('throws on non-2xx responses', async () => {
    const fetchFn = fetchReturning({}, false, 503);

    await expect(
      fetchRemoteAppConfig('https://config.example.com/app.json', fetchFn)
    ).rejects.toThrow(RemoteConfigError);
  });
});

describe('evaluateAppGate', () => {
  it('allows up-to-date clients through', () => {
    expect(evaluateAppGate({ config: baseConfig, appVersion: '1.2.0' })).toEqual({ status: 'ok' });
    expect(evaluateAppGate({ config: baseConfig, appVersion: '2.0.0' })).toEqual({ status: 'ok' });
  });

  it('blocks outdated clients with a force-update result', () => {
    expect(
      evaluateAppGate({
        config: { ...baseConfig, updateUrl: 'https://example.com/update' },
        appVersion: '1.1.0',
      })
    ).toEqual({
      status: 'force-update',
      minimumAppVersion: '1.2.0',
      updateUrl: 'https://example.com/update',
    });
  });

  it('maintenance mode takes precedence over force-update', () => {
    expect(
      evaluateAppGate({
        config: { ...baseConfig, maintenanceMode: true, maintenanceMessage: 'Back soon' },
        appVersion: '1.0.0',
      })
    ).toEqual({ status: 'maintenance', message: 'Back soon' });
  });

  it('dev bypass flag skips both gates', () => {
    expect(
      evaluateAppGate({
        config: { ...baseConfig, maintenanceMode: true },
        appVersion: '0.0.1',
        bypass: true,
      })
    ).toEqual({ status: 'ok' });
  });
});

describe('checkAppGate', () => {
  it('resolves ok without fetching when no config URL is set', async () => {
    const fetchFn = jest.fn();

    await expect(checkAppGate({ appVersion: '1.0.0', fetchFn })).resolves.toEqual({ status: 'ok' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('resolves ok without fetching when the dev bypass is enabled', async () => {
    const fetchFn = jest.fn();

    await expect(
      checkAppGate({
        configUrl: 'https://config.example.com/app.json',
        appVersion: '1.0.0',
        bypass: true,
        fetchFn,
      })
    ).resolves.toEqual({ status: 'ok' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('evaluates the fetched config against the app version', async () => {
    const fetchFn = fetchReturning({ minimumAppVersion: '1.2.0', maintenanceMode: false });

    await expect(
      checkAppGate({
        configUrl: 'https://config.example.com/app.json',
        appVersion: '1.1.0',
        fetchFn,
      })
    ).resolves.toEqual({
      status: 'force-update',
      minimumAppVersion: '1.2.0',
      updateUrl: undefined,
    });
  });

  it('fails open when the config fetch rejects', async () => {
    const fetchFn: FetchLike = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(
      checkAppGate({
        configUrl: 'https://config.example.com/app.json',
        appVersion: '1.0.0',
        fetchFn,
      })
    ).resolves.toEqual({ status: 'ok' });
  });

  it('fails open when the payload is malformed', async () => {
    const fetchFn = fetchReturning({ minimumAppVersion: 42 });

    await expect(
      checkAppGate({
        configUrl: 'https://config.example.com/app.json',
        appVersion: '1.0.0',
        fetchFn,
      })
    ).resolves.toEqual({ status: 'ok' });
  });
});
