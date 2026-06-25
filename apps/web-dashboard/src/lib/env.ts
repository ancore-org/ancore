import { z } from 'zod';

const urlSchema = z.string().url({ message: 'must be a valid URL (include http:// or https://)' });

const envSchema = z.object({
  /** Base URL for the Ancore relayer service. */
  VITE_RELAYER_URL: urlSchema,
  /** Base URL for the Ancore indexer service. */
  VITE_INDEXER_BASE_URL: urlSchema,
  /** Set to "true" to enable the PDF export button on the Statements page. */
  VITE_STATEMENT_PDF_EXPORT: z.enum(['true', 'false']).default('false'),
});

type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const raw = {
    VITE_RELAYER_URL: import.meta.env.VITE_RELAYER_URL,
    VITE_INDEXER_BASE_URL: import.meta.env.VITE_INDEXER_BASE_URL,
    VITE_STATEMENT_PDF_EXPORT: import.meta.env.VITE_STATEMENT_PDF_EXPORT,
  };

  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');

    const message = `[env] Invalid environment configuration:\n${issues}\n\nCopy apps/web-dashboard/.env.example to .env.local and fill in all values.`;

    // Fail fast in development so misconfiguration is immediately visible.
    if (import.meta.env.DEV) {
      throw new Error(message);
    }

    console.error(message);
  }

  return result.success ? result.data : (raw as unknown as Env);
}

export const env = parseEnv();
