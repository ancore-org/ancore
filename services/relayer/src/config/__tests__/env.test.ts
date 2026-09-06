import {
  BOUNDS,
  DEFAULT_NETWORK_PASSPHRASE,
  DEFAULT_PORT,
  DEFAULT_RELAY_MAX_PAYLOAD_BYTES,
  DEFAULT_RELAY_RATE_LIMIT_MAX,
  DEFAULT_RELAY_RATE_LIMIT_RPM,
  DEFAULT_RPC_URL,
  DEFAULT_SCHEDULER_POLL_INTERVAL_MS,
  DEFAULT_SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS,
  DEFAULT_STATUS_RATE_LIMIT_MAX,
  EnvValidationError,
  getEnv,
  loadEnvOrExit,
  parseEnv,
  resetEnvCache,
} from '../env';

/** An env object with nothing relayer-specific set. */
const EMPTY: NodeJS.ProcessEnv = {};

describe('relayer env schema', () => {
  afterEach(() => {
    resetEnvCache();
  });

  describe('defaults', () => {
    it('boots with every variable unset', () => {
      const env = parseEnv(EMPTY);

      // Optional variables are absent from the parsed object rather than
      // present-and-undefined, so they are asserted separately below.
      expect(env.RELAYER_AUTH_SECRET).toBeUndefined();
      expect(env.STELLAR_NETWORK_PASSPHRASE).toBeUndefined();
      expect(env.DATABASE_URL).toBeUndefined();

      expect(env).toMatchObject({
        NODE_ENV: 'development',
        PORT: DEFAULT_PORT,
        ALLOWED_ORIGINS: '*',
        STELLAR_NETWORK: 'testnet',
        RPC_URL: DEFAULT_RPC_URL,
        NETWORK_PASSPHRASE: DEFAULT_NETWORK_PASSPHRASE,
        RELAY_RATE_LIMIT_MAX: DEFAULT_RELAY_RATE_LIMIT_MAX,
        STATUS_RATE_LIMIT_MAX: DEFAULT_STATUS_RATE_LIMIT_MAX,
        RELAY_RATE_LIMIT_RPM: DEFAULT_RELAY_RATE_LIMIT_RPM,
        RELAY_MAX_PAYLOAD_BYTES: DEFAULT_RELAY_MAX_PAYLOAD_BYTES,
        SCHEDULER_POLL_INTERVAL_MS: DEFAULT_SCHEDULER_POLL_INTERVAL_MS,
        SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS: DEFAULT_SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS,
        RELAYER_USE_MOCK_SUBMISSION: false,
      });
    });

    it('treats an empty string as unset', () => {
      const env = parseEnv({
        PORT: '',
        RELAYER_AUTH_SECRET: '',
        ALLOWED_ORIGINS: '',
        RPC_URL: '   ',
        RELAYER_USE_MOCK_SUBMISSION: '',
        DATABASE_URL: '',
      });

      expect(env.PORT).toBe(DEFAULT_PORT);
      expect(env.RELAYER_AUTH_SECRET).toBeUndefined();
      expect(env.ALLOWED_ORIGINS).toBe('*');
      expect(env.RPC_URL).toBe(DEFAULT_RPC_URL);
      expect(env.RELAYER_USE_MOCK_SUBMISSION).toBe(false);
      expect(env.DATABASE_URL).toBeUndefined();
    });

    it('ignores unrelated variables', () => {
      const env = parseEnv({ SOME_UNRELATED_THING: 'x', PORT: '4000' });

      expect(env.PORT).toBe(4000);
      expect(env).not.toHaveProperty('SOME_UNRELATED_THING');
    });
  });

  describe('numeric coercion and bounds', () => {
    it('coerces numeric strings to numbers', () => {
      const env = parseEnv({
        PORT: '8080',
        RELAY_RATE_LIMIT_MAX: '25',
        STATUS_RATE_LIMIT_MAX: '500',
        RELAY_RATE_LIMIT_RPM: '10',
        RELAY_MAX_PAYLOAD_BYTES: '2048',
        SCHEDULER_POLL_INTERVAL_MS: '250',
        SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS: '750',
      });

      expect(env.PORT).toBe(8080);
      expect(env.RELAY_RATE_LIMIT_MAX).toBe(25);
      expect(env.STATUS_RATE_LIMIT_MAX).toBe(500);
      expect(env.RELAY_RATE_LIMIT_RPM).toBe(10);
      expect(env.RELAY_MAX_PAYLOAD_BYTES).toBe(2048);
      expect(env.SCHEDULER_POLL_INTERVAL_MS).toBe(250);
      expect(env.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS).toBe(750);
    });

    it.each([
      ['PORT', 'not-a-number'],
      ['RELAY_RATE_LIMIT_MAX', 'fifty'],
      ['STATUS_RATE_LIMIT_MAX', '1e'],
      ['SCHEDULER_POLL_INTERVAL_MS', 'soon'],
    ])('rejects a non-numeric %s', (name, value) => {
      expect(() => parseEnv({ [name]: value })).toThrow(new RegExp(`${name}: must be an integer`));
    });

    it('rejects non-integer values', () => {
      expect(() => parseEnv({ RELAY_RATE_LIMIT_MAX: '12.5' })).toThrow(
        /RELAY_RATE_LIMIT_MAX: must be a whole number/
      );
    });

    const boundedNames = Object.keys(BOUNDS) as Array<keyof typeof BOUNDS>;

    it.each(boundedNames)('enforces the bounds on %s', (name) => {
      const bound = BOUNDS[name];

      expect(() => parseEnv({ [name]: String(bound.min - 1) })).toThrow(
        new RegExp(`${name}: must be at least ${bound.min}`)
      );
      expect(() => parseEnv({ [name]: String(bound.max + 1) })).toThrow(
        new RegExp(`${name}: must be at most ${bound.max}`)
      );
      expect(() => parseEnv({ [name]: String(bound.min) })).not.toThrow();
      expect(() => parseEnv({ [name]: String(bound.max) })).not.toThrow();
    });

    it('rejects a zero or negative rate limit', () => {
      expect(() => parseEnv({ RELAY_RATE_LIMIT_MAX: '0' })).toThrow(
        /RELAY_RATE_LIMIT_MAX: must be at least 1/
      );
      expect(() => parseEnv({ STATUS_RATE_LIMIT_MAX: '-5' })).toThrow(
        /STATUS_RATE_LIMIT_MAX: must be at least 1/
      );
    });
  });

  describe('RPC URL and network passphrase', () => {
    it('accepts a valid RPC URL', () => {
      expect(parseEnv({ RPC_URL: 'https://rpc.example.com' }).RPC_URL).toBe(
        'https://rpc.example.com'
      );
    });

    it('rejects an RPC URL without a scheme', () => {
      expect(() => parseEnv({ RPC_URL: 'soroban-testnet.stellar.org' })).toThrow(
        /RPC_URL: must be a valid URL/
      );
    });

    it('accepts a custom network passphrase', () => {
      const passphrase = 'Public Global Stellar Network ; September 2015';
      expect(parseEnv({ NETWORK_PASSPHRASE: passphrase }).NETWORK_PASSPHRASE).toBe(passphrase);
    });

    it('accepts every supported STELLAR_NETWORK value', () => {
      for (const network of ['testnet', 'mainnet', 'futurenet', 'local'] as const) {
        expect(parseEnv({ STELLAR_NETWORK: network }).STELLAR_NETWORK).toBe(network);
      }
    });

    it('rejects an unknown STELLAR_NETWORK instead of silently defaulting', () => {
      expect(() => parseEnv({ STELLAR_NETWORK: 'mainnett' })).toThrow(/STELLAR_NETWORK/);
    });
  });

  describe('ALLOWED_ORIGINS', () => {
    it('splits and trims a comma-separated list', () => {
      expect(
        parseEnv({ ALLOWED_ORIGINS: 'http://localhost:5173, https://app.example.com' })
          .ALLOWED_ORIGINS
      ).toEqual(['http://localhost:5173', 'https://app.example.com']);
    });

    it('rejects a list that contains no usable origin', () => {
      expect(() => parseEnv({ ALLOWED_ORIGINS: ' , , ' })).toThrow(
        /ALLOWED_ORIGINS: must list at least one origin/
      );
    });
  });

  describe('DATABASE_URL', () => {
    it('accepts a valid postgres connection string', () => {
      expect(
        parseEnv({ DATABASE_URL: 'postgres://user:pass@localhost:5432/ancore' }).DATABASE_URL
      ).toBe('postgres://user:pass@localhost:5432/ancore');
    });
  });

  describe('RELAYER_USE_MOCK_SUBMISSION', () => {
    it('decodes true/false', () => {
      expect(parseEnv({ RELAYER_USE_MOCK_SUBMISSION: 'true' }).RELAYER_USE_MOCK_SUBMISSION).toBe(
        true
      );
      expect(parseEnv({ RELAYER_USE_MOCK_SUBMISSION: 'false' }).RELAYER_USE_MOCK_SUBMISSION).toBe(
        false
      );
    });

    it('rejects any other value', () => {
      expect(() => parseEnv({ RELAYER_USE_MOCK_SUBMISSION: 'yes' })).toThrow(
        /RELAYER_USE_MOCK_SUBMISSION/
      );
    });
  });

  describe('error reporting', () => {
    it('lists every offending variable in one error', () => {
      let caught: unknown;
      try {
        parseEnv({
          RELAY_RATE_LIMIT_MAX: '0',
          STATUS_RATE_LIMIT_MAX: 'lots',
          RPC_URL: 'not-a-url',
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      const issues = (caught as EnvValidationError).issues;
      expect(issues).toHaveLength(3);
      expect(issues.join('\n')).toContain('RELAY_RATE_LIMIT_MAX');
      expect(issues.join('\n')).toContain('STATUS_RATE_LIMIT_MAX');
      expect(issues.join('\n')).toContain('RPC_URL');
    });

    it('produces a readable, actionable message', () => {
      expect(() => parseEnv({ RPC_URL: 'not-a-url' })).toThrow(
        /\[relayer\/env\] Invalid environment configuration:/
      );
      expect(() => parseEnv({ RPC_URL: 'not-a-url' })).toThrow(/services\/relayer\/README\.md/);
    });
  });

  describe('caching', () => {
    it('parses once and reuses the result', () => {
      const first = getEnv({ ...EMPTY, PORT: '4100' });
      const second = getEnv({ ...EMPTY, PORT: '4200' });

      expect(first).toBe(second);
      expect(second.PORT).toBe(4100);
    });

    it('re-parses after resetEnvCache()', () => {
      expect(getEnv({ ...EMPTY, PORT: '4100' }).PORT).toBe(4100);
      resetEnvCache();
      expect(getEnv({ ...EMPTY, PORT: '4200' }).PORT).toBe(4200);
    });
  });

  describe('loadEnvOrExit', () => {
    it('returns the parsed env when valid', () => {
      expect(loadEnvOrExit({ ...EMPTY, PORT: '4300' }).PORT).toBe(4300);
    });

    it('logs the issues and exits with code 1 when invalid', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation((code?: number | string | null) => {
          throw new Error(`process.exit:${code ?? 'undefined'}`);
        }) as unknown as jest.SpyInstance;

      try {
        expect(() => loadEnvOrExit({ ...EMPTY, RELAY_RATE_LIMIT_MAX: '0' })).toThrow(
          'process.exit:1'
        );
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('RELAY_RATE_LIMIT_MAX: must be at least 1')
        );
      } finally {
        errorSpy.mockRestore();
        exitSpy.mockRestore();
      }
    });
  });
});
