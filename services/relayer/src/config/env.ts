import { z } from 'zod';

/**
 * Centralised, validated environment configuration for the relayer service.
 *
 * Every environment variable the relayer reads is declared exactly once in the
 * schema below. Modules must import {@link getEnv} instead of touching
 * `process.env` directly, so that:
 *
 *  - misconfiguration fails at boot with a readable list of offending
 *    variables, rather than surfacing as confusing runtime behaviour;
 *  - defaults live in one place and are documented alongside their bounds;
 *  - numeric values are parsed and bounds-checked once, not re-parsed with
 *    ad-hoc `parseInt` at each call site.
 *
 * Mirrors the pattern adopted by the web-dashboard in `apps/web-dashboard/src/lib/env.ts`.
 *
 * NOTE: `OTEL_*` variables are intentionally NOT covered here. They are owned by
 * the OpenTelemetry SDK and are read in `src/tracing.ts`, which must execute
 * before any other relayer module is imported.
 */

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_PORT = 3000;
export const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
export const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const DEFAULT_RELAY_RATE_LIMIT_MAX = 50;
export const DEFAULT_STATUS_RATE_LIMIT_MAX = 200;
export const DEFAULT_RELAY_RATE_LIMIT_RPM = 30;
export const DEFAULT_RELAY_MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KiB
export const DEFAULT_SCHEDULER_POLL_INTERVAL_MS = 1_000;
export const DEFAULT_SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS = 5_000;

// ── Bounds ───────────────────────────────────────────────────────────────────

/**
 * Upper bounds exist to catch fat-finger misconfiguration (e.g. a rate limit of
 * `500000` where `50` was meant) rather than to express a hard capability
 * limit. They are deliberately generous.
 */
export const BOUNDS = {
  PORT: { min: 1, max: 65_535 },
  RELAY_RATE_LIMIT_MAX: { min: 1, max: 10_000 },
  STATUS_RATE_LIMIT_MAX: { min: 1, max: 10_000 },
  RELAY_RATE_LIMIT_RPM: { min: 1, max: 600 },
  /** 1 byte … 16 MiB. */
  RELAY_MAX_PAYLOAD_BYTES: { min: 1, max: 16 * 1024 * 1024 },
  /** 50 ms … 1 hour. Below 50 ms the scheduler would busy-spin. */
  SCHEDULER_POLL_INTERVAL_MS: { min: 50, max: 3_600_000 },
  /** 1 ms … 2 minutes. */
  SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS: { min: 1, max: 120_000 },
} as const;

// ── Schema building blocks ───────────────────────────────────────────────────

/**
 * Treat an unset variable and an explicitly empty one identically. Deployment
 * tooling routinely injects `FOO=` for "not configured", and an empty string is
 * never a meaningful value for anything the relayer reads.
 */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const rawString = z.preprocess(emptyToUndefined, z.string().optional());

/** An integer parsed from a string, constrained to `[min, max]`. */
function intInRange(min: number, max: number, defaultValue: number) {
  return rawString
    .transform((raw) => (raw === undefined ? defaultValue : Number(raw)))
    .pipe(
      z
        .number({ invalid_type_error: 'must be an integer' })
        .int('must be a whole number')
        .min(min, `must be at least ${min}`)
        .max(max, `must be at most ${max}`)
    );
}

/** A `'true'` / `'false'` flag decoded to a boolean. */
function boolFlag(defaultValue: boolean) {
  return z
    .preprocess(emptyToUndefined, z.enum(['true', 'false']).optional())
    .transform((value) => (value === undefined ? defaultValue : value === 'true'));
}

const urlString = (defaultValue: string) =>
  z.preprocess(
    emptyToUndefined,
    z.string().url('must be a valid URL (include http:// or https://)').default(defaultValue)
  );

// ── Schema ───────────────────────────────────────────────────────────────────

export const relayerEnvSchema = z.object({
  // Runtime
  /** Node runtime mode. Only `production` changes relayer behaviour (auth guard). */
  NODE_ENV: z.preprocess(emptyToUndefined, z.string().min(1).default('development')),
  /** HTTP listen port. */
  PORT: intInRange(BOUNDS.PORT.min, BOUNDS.PORT.max, DEFAULT_PORT),

  // Auth and CORS
  /** Bearer token secret for protected `/relay` routes. Required in production. */
  RELAYER_AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'must not be empty').optional()
  ),
  /**
   * Comma-separated CORS allowlist. Unset means `'*'` (any origin), which is
   * the express `cors` wildcard and must not be used in production.
   */
  ALLOWED_ORIGINS: rawString
    .transform((raw): string[] | '*' => {
      if (raw === undefined) return '*';
      return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
    })
    .refine(
      (value) => value === '*' || value.length > 0,
      'must list at least one origin, e.g. "http://localhost:5173,https://app.example.com"'
    ),

  // Stellar network
  /** Network preset used by the transaction submitter. */
  STELLAR_NETWORK: z.preprocess(
    emptyToUndefined,
    z.enum(['testnet', 'mainnet', 'futurenet', 'local']).default('testnet')
  ),
  /** Overrides the passphrase derived from `STELLAR_NETWORK`. */
  STELLAR_NETWORK_PASSPHRASE: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'must not be empty').optional()
  ),
  /** Soroban RPC endpoint used for on-chain session-key lookups. */
  RPC_URL: urlString(DEFAULT_RPC_URL),
  /** Passphrase used for on-chain session-key lookups. */
  NETWORK_PASSPHRASE: z.preprocess(
    emptyToUndefined,
    z.string().min(1, 'must not be empty').default(DEFAULT_NETWORK_PASSPHRASE)
  ),

  // Limits and timers
  /** Per-caller/IP requests per 15-minute window on `/relay/*`. */
  RELAY_RATE_LIMIT_MAX: intInRange(
    BOUNDS.RELAY_RATE_LIMIT_MAX.min,
    BOUNDS.RELAY_RATE_LIMIT_MAX.max,
    DEFAULT_RELAY_RATE_LIMIT_MAX
  ),
  /** Per-IP requests per 15-minute window on `/relay/status`. */
  STATUS_RATE_LIMIT_MAX: intInRange(
    BOUNDS.STATUS_RATE_LIMIT_MAX.min,
    BOUNDS.STATUS_RATE_LIMIT_MAX.max,
    DEFAULT_STATUS_RATE_LIMIT_MAX
  ),
  /** Per-account requests per minute on `/relay/execute`. */
  RELAY_RATE_LIMIT_RPM: intInRange(
    BOUNDS.RELAY_RATE_LIMIT_RPM.min,
    BOUNDS.RELAY_RATE_LIMIT_RPM.max,
    DEFAULT_RELAY_RATE_LIMIT_RPM
  ),
  /** Request bodies above this are rejected before JSON parsing. */
  RELAY_MAX_PAYLOAD_BYTES: intInRange(
    BOUNDS.RELAY_MAX_PAYLOAD_BYTES.min,
    BOUNDS.RELAY_MAX_PAYLOAD_BYTES.max,
    DEFAULT_RELAY_MAX_PAYLOAD_BYTES
  ),
  /** Scheduled-transfer engine poll interval. */
  SCHEDULER_POLL_INTERVAL_MS: intInRange(
    BOUNDS.SCHEDULER_POLL_INTERVAL_MS.min,
    BOUNDS.SCHEDULER_POLL_INTERVAL_MS.max,
    DEFAULT_SCHEDULER_POLL_INTERVAL_MS
  ),
  /** Timeout for the signature-service health probe. */
  SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS: intInRange(
    BOUNDS.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS.min,
    BOUNDS.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS.max,
    DEFAULT_SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS
  ),

  // Dev-only flags
  /** Skips Stellar entirely and returns a synthetic transaction id. Never enable in production. */
  RELAYER_USE_MOCK_SUBMISSION: boolFlag(false),
});

export type RelayerEnv = z.infer<typeof relayerEnvSchema>;

// ── Parsing ──────────────────────────────────────────────────────────────────

/** Thrown when one or more environment variables fail validation. */
export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      [
        '[relayer/env] Invalid environment configuration:',
        ...issues.map((issue) => `  ${issue}`),
        '',
        'Fix the variables listed above and restart. See services/relayer/README.md',
        'for the full list of supported variables, their defaults, and bounds.',
      ].join('\n')
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    return `${name}: ${issue.message}`;
  });
}

/**
 * Parses and validates `source` against the relayer env schema.
 *
 * Always re-parses — use {@link getEnv} on hot paths.
 *
 * @throws {EnvValidationError} listing every offending variable at once.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): RelayerEnv {
  const result = relayerEnvSchema.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(formatIssues(result.error));
  }

  return result.data;
}

let cachedEnv: RelayerEnv | null = null;

/**
 * Returns the validated environment, parsing it on first access and caching the
 * result for the lifetime of the process.
 *
 * @throws {EnvValidationError} on the first call if the environment is invalid.
 */
export function getEnv(source: NodeJS.ProcessEnv = process.env): RelayerEnv {
  if (cachedEnv === null) {
    cachedEnv = parseEnv(source);
  }
  return cachedEnv;
}

/**
 * Clears the cached environment so the next {@link getEnv} call re-parses.
 *
 * Intended for tests that mutate `process.env`; production code should never
 * need this.
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}

/**
 * Boot-time entry point: validates the environment and terminates the process
 * with a readable error rather than letting misconfiguration leak into request
 * handling.
 */
export function loadEnvOrExit(source: NodeJS.ProcessEnv = process.env): RelayerEnv {
  try {
    return getEnv(source);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
