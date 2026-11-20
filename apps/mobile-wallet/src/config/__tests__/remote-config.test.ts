import {
  REMOTE_CONFIG_TIMEOUT_MS,
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
    // The abort signal is passed on every call now — it is what bounds the
    // startup gate (#1352).
    expect(fetchFn).toHaveBeenCalledWith('https://config.example.com/app.json', {
      signal: expect.any(AbortSignal),
    });
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

/**
 * #1352: the gate's "an unreachable config host must never brick the wallet"
 * promise only held against clean failures. A stalled connection never
 * rejects, so nothing forced the startup gate to resolve.
 */
describe('fetchRemoteAppConfig timeout (#1352)', () => {
  /** A fetch that respects the abort signal but never resolves on its own. */
  const stalledFetch = jest.fn(
    (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
  );

  beforeEach(() => {
    stalledFetch.mockClear();
  });

  it('gives up on a connection that never settles', async () => {
    await expect(
      fetchRemoteAppConfig('https://config.example.com/app.json', stalledFetch, 20)
    ).rejects.toThrow(RemoteConfigError);
  });

  it('reports the timeout as an ordinary config error, so the gate fails open', async () => {
    await expect(
      fetchRemoteAppConfig('https://config.example.com/app.json', stalledFetch, 20)
    ).rejects.toThrow(/timed out after 20ms/);
  });

  it('lets the app through when the config host stalls', async () => {
    await expect(
      checkAppGate({
        configUrl: 'https://config.example.com/app.json',
        appVersion: '1.0.0',
        fetchFn: stalledFetch,
        timeoutMs: 20,
      })
    ).resolves.toEqual({ status: 'ok' });
  });

  /**
   * The gate runs before the user can do anything, so the bound has to be
   * short enough to be invisible on a launch screen.
   */
  it('defaults to a startup-appropriate timeout', () => {
    expect(REMOTE_CONFIG_TIMEOUT_MS).toBeGreaterThan(0);
    expect(REMOTE_CONFIG_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  it('does not abort a response that arrives in time', async () => {
    const quickFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ minimumAppVersion: '1.2.0', maintenanceMode: false }),
    }));

    await expect(
      fetchRemoteAppConfig('https://config.example.com/app.json', quickFetch, 1_000)
    ).resolves.toEqual(baseConfig);
  });

  it('still surfaces a non-timeout network failure unchanged', async () => {
    const failing = jest.fn(async () => {
      throw new Error('DNS lookup failed');
    });

    await expect(
      fetchRemoteAppConfig('https://config.example.com/app.json', failing, 1_000)
    ).rejects.toThrow('DNS lookup failed');
  });
});

/**
 * #1618: the timeout has to bound the whole request, and it must never leave a timer
 * behind. The first version cleared the timer as soon as the response headers arrived, so
 * a body that stalled after that hung startup indefinitely, and it relied on `fetchFn`
 * honouring the abort signal.
 */
describe('fetchRemoteAppConfig bounds the whole request (#1618)', () => {
  const URL = 'https://config.example.com/app.json';
  const validBody = { minimumAppVersion: '1.2.0', maintenanceMode: false };

  const respondingWith = (json: () => Promise<unknown>, ok = true, status = 200): FetchLike =>
    jest.fn(async () => ({ ok, status, json })) as unknown as FetchLike;

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('uses a 5000ms timeout by default', () => {
    expect(REMOTE_CONFIG_TIMEOUT_MS).toBe(5_000);
  });

  describe('a response body that never finishes', () => {
    const stalledBody = () => respondingWith(() => new Promise<never>(() => undefined));

    it('rejects with a timeout error once the time is up', async () => {
      const result = fetchRemoteAppConfig(URL, stalledBody(), 5_000);
      const assertion = expect(result).rejects.toThrow(/timed out after 5000ms/);

      await jest.advanceTimersByTimeAsync(5_000);

      await assertion;
    });

    it('is still pending just before the timeout', async () => {
      let settled = false;
      fetchRemoteAppConfig(URL, stalledBody(), 5_000).then(
        () => (settled = true),
        () => (settled = true)
      );

      await jest.advanceTimersByTimeAsync(4_999);

      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
    });

    it('lets the app through at the gate', async () => {
      const gate = checkAppGate({
        configUrl: URL,
        appVersion: '1.0.0',
        fetchFn: stalledBody(),
        timeoutMs: 5_000,
      });

      await jest.advanceTimersByTimeAsync(5_000);

      await expect(gate).resolves.toEqual({ status: 'ok' });
    });
  });

  describe('a fetch that ignores the abort signal', () => {
    const deafFetch = (): FetchLike =>
      jest.fn(() => new Promise<never>(() => undefined)) as unknown as FetchLike;

    it('still times out', async () => {
      const assertion = expect(fetchRemoteAppConfig(URL, deafFetch(), 3_000)).rejects.toThrow(
        /timed out after 3000ms/
      );

      await jest.advanceTimersByTimeAsync(3_000);

      await assertion;
    });

    it('lets the app through at the gate', async () => {
      const gate = checkAppGate({
        configUrl: URL,
        appVersion: '1.0.0',
        fetchFn: deafFetch(),
        timeoutMs: 3_000,
      });

      await jest.advanceTimersByTimeAsync(3_000);

      await expect(gate).resolves.toEqual({ status: 'ok' });
    });
  });

  describe('the abort signal', () => {
    it('is aborted when the request times out', async () => {
      let signal: AbortSignal | undefined;
      const fetchFn = jest.fn((_url: string, init?: { signal?: AbortSignal }) => {
        signal = init?.signal;
        return new Promise<never>(() => undefined);
      }) as unknown as FetchLike;

      const assertion = expect(fetchRemoteAppConfig(URL, fetchFn, 1_000)).rejects.toThrow();
      await jest.advanceTimersByTimeAsync(1_000);
      await assertion;

      expect(signal?.aborted).toBe(true);
    });

    it('is not aborted when the response arrives in time', async () => {
      let signal: AbortSignal | undefined;
      const fetchFn = jest.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
        signal = init?.signal;
        return { ok: true, status: 200, json: async () => validBody };
      }) as unknown as FetchLike;

      await expect(fetchRemoteAppConfig(URL, fetchFn, 1_000)).resolves.toEqual(baseConfig);

      expect(signal?.aborted).toBe(false);
    });
  });

  describe('timer cleanup', () => {
    it('leaves no timer behind after a success', async () => {
      await fetchRemoteAppConfig(
        URL,
        respondingWith(async () => validBody),
        5_000
      );

      expect(jest.getTimerCount()).toBe(0);
    });

    it('leaves no timer behind after a network failure', async () => {
      const failing = jest.fn(async () => {
        throw new Error('DNS lookup failed');
      }) as unknown as FetchLike;

      await expect(fetchRemoteAppConfig(URL, failing, 5_000)).rejects.toThrow('DNS lookup failed');

      expect(jest.getTimerCount()).toBe(0);
    });

    it('leaves no timer behind after a non-OK response', async () => {
      await expect(
        fetchRemoteAppConfig(
          URL,
          respondingWith(async () => ({}), false, 503),
          5_000
        )
      ).rejects.toThrow(/status 503/);

      expect(jest.getTimerCount()).toBe(0);
    });

    it('leaves no timer behind after a malformed payload', async () => {
      await expect(
        fetchRemoteAppConfig(
          URL,
          respondingWith(async () => ({ nonsense: true })),
          5_000
        )
      ).rejects.toThrow(RemoteConfigError);

      expect(jest.getTimerCount()).toBe(0);
    });

    it('leaves no timer behind after a timeout', async () => {
      const assertion = expect(
        fetchRemoteAppConfig(URL, jest.fn(() => new Promise(() => undefined)) as never, 1_000)
      ).rejects.toThrow();
      await jest.advanceTimersByTimeAsync(1_000);
      await assertion;

      expect(jest.getTimerCount()).toBe(0);
    });

    it('starts no timer when the gate is bypassed or unconfigured', async () => {
      await checkAppGate({ configUrl: URL, appVersion: '1.0.0', bypass: true });
      await checkAppGate({ appVersion: '1.0.0' });

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('late settlement after the timeout', () => {
    it('does not raise an unhandled rejection when the stalled fetch fails afterwards', async () => {
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      let rejectLate!: (error: Error) => void;
      const fetchFn = jest.fn(
        () => new Promise<never>((_resolve, reject) => (rejectLate = reject))
      ) as unknown as FetchLike;

      const assertion = expect(fetchRemoteAppConfig(URL, fetchFn, 1_000)).rejects.toThrow(
        /timed out/
      );
      await jest.advanceTimersByTimeAsync(1_000);
      await assertion;

      rejectLate(new Error('socket closed after the timeout'));
      await jest.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      process.off('unhandledRejection', unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    });
  });

  it('still returns the parsed config for a response that arrives in time', async () => {
    await expect(
      fetchRemoteAppConfig(
        URL,
        respondingWith(async () => validBody),
        5_000
      )
    ).resolves.toEqual(baseConfig);
  });

  it('does not time out a slow body that finishes before the limit', async () => {
    const slowBody = respondingWith(
      () => new Promise((resolve) => setTimeout(() => resolve(validBody), 4_000))
    );

    const result = fetchRemoteAppConfig(URL, slowBody, 5_000);
    await jest.advanceTimersByTimeAsync(4_000);

    await expect(result).resolves.toEqual(baseConfig);
    expect(jest.getTimerCount()).toBe(0);
  });
});
