import { z } from 'zod';

const urlSchema = z.string().url({ message: 'must be a valid URL (include http:// or https://)' });

export const envSchema = z.object({
  /** Base URL for the Ancore relayer service. */
  VITE_RELAYER_URL: urlSchema,
  /** Base URL for the Ancore indexer service. */
  VITE_INDEXER_BASE_URL: urlSchema,
  /** Set to "true" to enable the PDF export button on the Statements page. */
  VITE_STATEMENT_PDF_EXPORT: z.enum(['true', 'false']).default('false'),
  /** Horizon RPC/REST endpoint. Defaults to Stellar testnet. */
  VITE_HORIZON_URL: urlSchema.default('https://horizon-testnet.stellar.org'),
  /** Enable demo mode for the Send flow. */
  VITE_DEMO_MODE: z.enum(['true', 'false']).default('false'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(
  raw: Record<string, unknown> = {
    VITE_RELAYER_URL: import.meta.env.VITE_RELAYER_URL,
    VITE_INDEXER_BASE_URL: import.meta.env.VITE_INDEXER_BASE_URL,
    VITE_STATEMENT_PDF_EXPORT: import.meta.env.VITE_STATEMENT_PDF_EXPORT,
    VITE_HORIZON_URL: import.meta.env.VITE_HORIZON_URL,
    VITE_DEMO_MODE: import.meta.env.VITE_DEMO_MODE,
  }
): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');

    const message = `[env] Invalid environment configuration:\n${issues}\n\nCopy apps/web-dashboard/.env.example to .env.local and fill in all values.`;

    // Fail fast in every environment: running with unvalidated config produces
    // confusing downstream failures (e.g. undefined used to build a URL) far
    // from the real cause.
    throw new Error(message);
  }

  return result.data;
}

// Eagerly parse so main.tsx can `import './lib/env'` as a side-effect. Under
// Vitest the required values come from `test.env` in vitest.config.ts, so the
// singleton is populated there too and modules reading `env.VITE_*` behave the
// same as in the browser. Tests that exercise validation import parseEnv directly.
export const env: Env = parseEnv();
