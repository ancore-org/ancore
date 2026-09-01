import { envSchema, parseEnv } from '../env';

const VALID_ENV = {
  VITE_RELAYER_URL: 'http://localhost:3000',
  VITE_INDEXER_BASE_URL: 'http://localhost:4000',
  VITE_STATEMENT_PDF_EXPORT: 'false' as const,
  VITE_HORIZON_URL: 'https://horizon-testnet.stellar.org',
  VITE_DEMO_MODE: 'false' as const,
};

describe('env schema', () => {
  describe('valid configuration', () => {
    it('parses a fully specified valid config', () => {
      const result = envSchema.safeParse(VALID_ENV);
      expect(result.success).toBe(true);
    });

    it('accepts https URLs', () => {
      const result = envSchema.safeParse({
        ...VALID_ENV,
        VITE_RELAYER_URL: 'https://relayer.example.com',
        VITE_INDEXER_BASE_URL: 'https://indexer.example.com',
        VITE_HORIZON_URL: 'https://horizon.stellar.org',
      });
      expect(result.success).toBe(true);
    });

    it('defaults VITE_STATEMENT_PDF_EXPORT to "false" when omitted', () => {
      const rest: Partial<typeof VALID_ENV> = { ...VALID_ENV };
      delete rest.VITE_STATEMENT_PDF_EXPORT;
      const result = envSchema.safeParse(rest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.VITE_STATEMENT_PDF_EXPORT).toBe('false');
      }
    });

    it('accepts "true" for VITE_STATEMENT_PDF_EXPORT', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_STATEMENT_PDF_EXPORT: 'true' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.VITE_STATEMENT_PDF_EXPORT).toBe('true');
      }
    });

    it('defaults VITE_HORIZON_URL to testnet when omitted', () => {
      const { VITE_HORIZON_URL: _, ...rest } = VALID_ENV;
      const result = envSchema.safeParse(rest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.VITE_HORIZON_URL).toBe('https://horizon-testnet.stellar.org');
      }
    });

    it('defaults VITE_DEMO_MODE to "false" when omitted', () => {
      const { VITE_DEMO_MODE: _, ...rest } = VALID_ENV;
      const result = envSchema.safeParse(rest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.VITE_DEMO_MODE).toBe('false');
      }
    });

    it('accepts "true" for VITE_DEMO_MODE', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_DEMO_MODE: 'true' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.VITE_DEMO_MODE).toBe('true');
      }
    });
  });

  describe('invalid configuration', () => {
    it('fails when VITE_RELAYER_URL is not a valid URL', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_RELAYER_URL: 'not-a-url' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('VITE_RELAYER_URL');
      }
    });

    it('fails when VITE_INDEXER_BASE_URL is not a valid URL', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_INDEXER_BASE_URL: 'not-a-url' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('VITE_INDEXER_BASE_URL');
      }
    });

    it('fails when VITE_RELAYER_URL is missing', () => {
      const rest: Partial<typeof VALID_ENV> = { ...VALID_ENV };
      delete rest.VITE_RELAYER_URL;
      const result = envSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails when VITE_INDEXER_BASE_URL is missing', () => {
      const rest: Partial<typeof VALID_ENV> = { ...VALID_ENV };
      delete rest.VITE_INDEXER_BASE_URL;
      const result = envSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails for an unrecognised VITE_STATEMENT_PDF_EXPORT value', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_STATEMENT_PDF_EXPORT: 'yes' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('VITE_STATEMENT_PDF_EXPORT');
      }
    });

    it('fails for an unrecognised VITE_DEMO_MODE value', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_DEMO_MODE: 'yes' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('VITE_DEMO_MODE');
      }
    });

    it('fails when VITE_HORIZON_URL is not a valid URL', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_HORIZON_URL: 'not-a-url' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('VITE_HORIZON_URL');
      }
    });

    it('error messages are descriptive for invalid URL', () => {
      const result = envSchema.safeParse({ ...VALID_ENV, VITE_RELAYER_URL: 'not-a-url' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('VITE_RELAYER_URL'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBeTruthy();
      }
    });
  });
});

describe('parseEnv()', () => {
  it('returns parsed data for valid input', () => {
    const env = parseEnv(VALID_ENV);
    expect(env.VITE_RELAYER_URL).toBe('http://localhost:3000');
    expect(env.VITE_INDEXER_BASE_URL).toBe('http://localhost:4000');
    expect(env.VITE_STATEMENT_PDF_EXPORT).toBe('false');
    expect(env.VITE_HORIZON_URL).toBe('https://horizon-testnet.stellar.org');
    expect(env.VITE_DEMO_MODE).toBe('false');
  });

  it('throws when DEV is true and config is invalid', () => {
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as Record<string, unknown>).DEV = true;
      expect(() => parseEnv({ VITE_RELAYER_URL: 'bad' })).toThrow(
        '[env] Invalid environment configuration'
      );
    } finally {
      (import.meta.env as Record<string, unknown>).DEV = originalDev;
    }
  });

  it('throws when DEV is false and config is invalid, instead of returning unvalidated raw config', () => {
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as Record<string, unknown>).DEV = false;
      expect(() => parseEnv({ VITE_RELAYER_URL: 'bad' })).toThrow(
        '[env] Invalid environment configuration'
      );
    } finally {
      (import.meta.env as Record<string, unknown>).DEV = originalDev;
    }
  });

  it('throws when config is missing required values, regardless of DEV', () => {
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as Record<string, unknown>).DEV = false;
      expect(() => parseEnv({})).toThrow('[env] Invalid environment configuration');
    } finally {
      (import.meta.env as Record<string, unknown>).DEV = originalDev;
    }
  });
});
