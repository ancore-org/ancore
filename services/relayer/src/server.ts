import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { RelayService } from './services/relayService';
import { createStellarSubmitterFromEnv } from './services/stellarSubmitter';
import { createAuthMiddleware } from './middleware/auth';
import { createAccountRateLimiterMiddleware } from './middleware/accountRateLimiter';
import { createIdempotencyMiddleware } from './middleware/idempotency';
import { createPayloadGuardMiddleware } from './middleware/payloadGuard';
import { createRequestLoggerMiddleware } from './middleware/requestLogger';
import { createRequestIdMiddleware } from './middleware/requestId';
import { createMetricsCollectorMiddleware } from './middleware/metricsCollector';
import { renderPrometheusMetrics } from './metrics';
import { validateBody } from './validation/middleware';
import { createExecuteRelayHandler } from './handlers/executeRelay';
import { createValidateRelayHandler } from './handlers/validateRelay';
import { createHealthHandler } from './routes/health';
import { IdempotencyStore } from './store/idempotency';
import { NonceStore } from './store/nonceStore';
import { JobQueue } from './queue/JobQueue';
import { createBearerAuthService } from './services/bearerAuthService';
import type {
  AuthServiceContract,
  SignatureServiceContract,
  TransactionSubmitterContract,
  RelayServiceOptions,
} from './types';
import { Ed25519SignatureService } from './services/ed25519SignatureService';
import {
  ScheduledTransferStore,
  ScheduledTransferService,
  SchedulerEngine,
  createScheduledTransferSchema,
  createScheduledTransferHandler,
  createListScheduledTransfersHandler,
  createGetScheduledTransferHandler,
  createPauseScheduledTransferHandler,
  createCancelScheduledTransferHandler,
  createListExecutionsHandler,
} from './scheduler';

// ── Request schema ────────────────────────────────────────────────────────────

const relayRequestSchema = z.object({
  sessionKey: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]+$/),
  operation: z.enum(['relay_execute', 'add_session_key', 'revoke_session_key']),
  parameters: z.record(z.unknown()),
  signature: z
    .string()
    .length(128)
    .regex(/^[0-9a-fA-F]+$/),
  nonce: z.number().int().nonnegative(),
});

// ── Stub implementations (replace with real services) ─────────────────────────

const stubAuthService: AuthServiceContract = {
  async verifyToken(token: string) {
    if (!token) throw new Error('missing token');
    return { callerId: 'stub-caller' };
  },
};

const defaultSignatureService: SignatureServiceContract = new Ed25519SignatureService();

// ── App factory (exported for testing) ───────────────────────────────────────

/**
 * Parse ALLOWED_ORIGINS environment variable into an array of allowed origins.
 * Format: comma-separated list of origins (e.g., "http://localhost:3000,https://app.example.com")
 * If not set, defaults to allowing all origins for development ('*').
 */
function parseAllowedOrigins(): string[] | string {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (!envOrigins) {
    return '*'; // Default to wildcard for development
  }
  return envOrigins.split(',').map((origin) => origin.trim());
}

export function createApp(
  authService?: AuthServiceContract,
  signatureService: SignatureServiceContract = defaultSignatureService,
  idempotencyStore: IdempotencyStore = new IdempotencyStore(),
  transactionSubmitter?: TransactionSubmitterContract,
  relayOptions?: RelayServiceOptions,
  nonceStore: NonceStore = new NonceStore()
): Express {
  const authSecret = process.env.RELAYER_AUTH_SECRET;
  const resolvedAuthService =
    authService ?? (authSecret ? createBearerAuthService(authSecret) : stubAuthService);
  const app = express();

  const corsOrigins = parseAllowedOrigins();
  app.use(
    cors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      credentials: true,
    })
  );

  // Payload guard: reject oversized requests before body parsing to prevent
  // resource abuse. Runs early in the stack, before express.json().
  app.use(createPayloadGuardMiddleware());

  // Request ID middleware: validate or generate X-Request-Id, attach to req
  app.use(createRequestIdMiddleware());

  // Request logger: attaches req.log and emits start/complete structured logs.
  // Registered after CORS and payload guard, before auth and body parsing.
  app.use(createRequestLoggerMiddleware());

  // Metrics collector: records /relay/* latency histogram and error counter.
  // Registered after request logger so req.startTime is already set.
  app.use(createMetricsCollectorMiddleware());

  app.use(express.json());

  const useMockSubmission =
    relayOptions?.useMockSubmission === true || process.env.RELAYER_USE_MOCK_SUBMISSION === 'true';
  const submitter =
    transactionSubmitter ?? (useMockSubmission ? undefined : createStellarSubmitterFromEnv());

  // Rate limiting for relay operations
  const relayLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RELAY_RATE_LIMIT_MAX ? parseInt(process.env.RELAY_RATE_LIMIT_MAX) : 50, // limit each IP to 50 requests per windowMs
    message: 'Too many relay requests from this IP, please try again later.',
    keyGenerator: (req: Request) => {
      // If authenticated, use callerId, else use IP
      const callerId = (req as any).callerId;
      return callerId || req.ip;
    },
  });

  // Per-account rate limiting for relay execute: 30 req/min per account (independent of IP limiter above)
  const accountLimiter = createAccountRateLimiterMiddleware();

  // Rate limiting for status
  const statusLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.STATUS_RATE_LIMIT_MAX ? parseInt(process.env.STATUS_RATE_LIMIT_MAX) : 200, // higher limit for status
    message: 'Too many status requests from this IP, please try again later.',
  });

  const jobQueue = new JobQueue();
  const relayService = new RelayService(
    signatureService,
    jobQueue,
    idempotencyStore,
    submitter,
    {
      useMockSubmission,
      ...relayOptions,
    },
    nonceStore
  );
  const auth = createAuthMiddleware(resolvedAuthService);
  const validate = validateBody(relayRequestSchema);
  const idempotency = createIdempotencyMiddleware(idempotencyStore);

  const executeHandler = createExecuteRelayHandler(relayService);
  const validateHandler = createValidateRelayHandler(relayService);
  const healthHandler = createHealthHandler(relayService);

  const scheduledTransferStore = new ScheduledTransferStore();
  const scheduledTransferService = new ScheduledTransferService(
    scheduledTransferStore,
    relayService
  );
  const schedulerEngine = new SchedulerEngine(scheduledTransferService, {
    pollIntervalMs: process.env.SCHEDULER_POLL_INTERVAL_MS
      ? parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS, 10)
      : 1_000,
  });

  if (relayOptions?.startScheduler !== false) {
    schedulerEngine.start();
  }

  const validateScheduledTransfer = validateBody(createScheduledTransferSchema);

  app.post(
    '/relay/execute',
    auth,
    relayLimiter,
    accountLimiter,
    validate,
    idempotency,
    executeHandler
  );
  app.post('/relay/validate', auth, relayLimiter, validate, validateHandler);
  app.get('/relay/status', statusLimiter, (_req, res) => res.json(relayService.health()));
  app.get('/health', healthHandler);
  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(renderPrometheusMetrics());
  });

  app.post(
    '/api/v1/scheduled-transfers',
    auth,
    validateScheduledTransfer,
    createScheduledTransferHandler(scheduledTransferService)
  );
  app.get(
    '/api/v1/scheduled-transfers',
    auth,
    createListScheduledTransfersHandler(scheduledTransferService)
  );
  app.get(
    '/api/v1/scheduled-transfers/:id',
    auth,
    createGetScheduledTransferHandler(scheduledTransferService)
  );
  app.patch(
    '/api/v1/scheduled-transfers/:id/pause',
    auth,
    createPauseScheduledTransferHandler(scheduledTransferService)
  );
  app.patch(
    '/api/v1/scheduled-transfers/:id/cancel',
    auth,
    createCancelScheduledTransferHandler(scheduledTransferService)
  );
  app.get(
    '/api/v1/scheduled-transfers/:id/executions',
    auth,
    createListExecutionsHandler(scheduledTransferService)
  );

  return app;
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const PORT = process.env['PORT'] ?? 3000;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Relayer service listening on port ${PORT}`);
  });
}
