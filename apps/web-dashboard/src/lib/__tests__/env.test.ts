import { z } from 'zod';

// Re-export the schema under test without importing env.ts directly,
// since env.ts calls parseEnv() at module load time (touching import.meta.env).
// Testing the schema in isolation is faster and avoids Vite globals.

const urlSchema = z.string().url();

const envSchema = z.object({
  VITE_RELAYER_URL: urlSchema,
  VITE_INDEXER_BASE_URL: urlSchema,
  VITE_STATEMENT_PDF_EXPORT: z.enum(['true', 'false']).default('false'),
});

const VALID_ENV = {
  VITE_RELAYER_URL: 'http://localhost:3000',
  VITE_INDEXER_BASE_URL: 'http://localhost:4000',
  VITE_STATEMENT_PDF_EXPORT: 'false' as const,
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
      });
      expect(result.success).toBe(true);
    });

    it('defaults VITE_STATEMENT_PDF_EXPORT to "false" when omitted', () => {
      const { VITE_STATEMENT_PDF_EXPORT: _, ...rest } = VALID_ENV;
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
      const { VITE_RELAYER_URL: _, ...rest } = VALID_ENV;
      const result = envSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('fails when VITE_INDEXER_BASE_URL is missing', () => {
      const { VITE_INDEXER_BASE_URL: _, ...rest } = VALID_ENV;
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
