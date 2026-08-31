// Tracing must be imported first to register the OpenTelemetry SDK before
// any other module creates spans or instruments HTTP traffic.
import './tracing';

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Pool } from 'pg';
import { TransferPolicySchema } from '@ancore/types';
import { loadEnvOrExit } from './config/env';
import { runMigrations } from './migrations';
import { RelayService } from './services/relayService';
import { createStellarSubmitterFromEnv } from './services/stellarSubmitter';
import { createAuthMiddleware } from './middleware/auth';
import { createAccountRateLimiterMiddleware } from './middleware/accountRateLimiter';
import { createIdempotencyMiddleware } from './middleware/idempotency';
import { createPayloadGuardMiddleware } from './middleware/payloadGuard';
import { createContentTypeGuardMiddleware } from './middleware/contentTypeGuard';
import { createRequestLoggerMiddleware } from './middleware/requestLogger';
import { createRequestIdMiddleware } from './middleware/requestId';
import { createMetricsCollectorMiddleware, relayMockMode } from './middleware/metricsCollector';
import { renderPrometheusMetrics } from './metrics';
import { validateBody } from './validation/middleware';
import { createExecuteRelayHandler } from './handlers/executeRelay';
import { createValidateRelayHandler } from './handlers/validateRelay';
import { createHealthHandler } from './routes/health';
import {
  IdempotencyStore,
  PgIdempotencyStore,
  MemoryNonceStore,
  PgNonceStore,
  type AnyIdempotencyStore,
  type NonceStore,
} from './store';
import { JobQueue, PgJobQueue, type AnyJobQueue } from './queue';
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
  PgScheduledTransferStore,
  ScheduledTransferService,
  SchedulerEngine,
  createScheduledTransferSchema,
  createScheduledTransferHandler,
  createListScheduledTransfersHandler,
  createGetScheduledTransferHandler,
  createPauseScheduledTransferHandler,
  createCancelScheduledTransferHandler,
  createListExecutionsHandler,
  type AnyScheduledTransferStore,
} from './scheduler';

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
  transferPolicy: z
    .object({
      policy: TransferPolicySchema,
      amount: z.number(),
      todayTotal: z.number(),
    })
    .optional(),
});

const stubAuthService: AuthServiceContract = {
  async verifyToken(token: string) {
    if (!token) throw new Error('missing token');
    return { callerId: 'stub-caller' };
  },
};

const defaultSignatureService: SignatureServiceContract = new Ed25519SignatureService();

export function createApp(
  authService?: AuthServiceContract,
  signatureService: SignatureServiceContract = defaultSignatureService,
  idempotencyStore?: AnyIdempotencyStore,
  transactionSubmitter?: TransactionSubmitterContract,
  relayOptions?: RelayServiceOptions,
  nonceStore?: NonceStore,
  jobQueue?: AnyJobQueue,
  scheduledTransferStore?: AnyScheduledTransferStore,
  pool?: Pool
): Express {
  // Fail fast on misconfiguration before any middleware or listener is wired up.
  const env = loadEnvOrExit();

  const authSecret = env.RELAYER_AUTH_SECRET;
  const hasConfiguredAuth = Boolean(authService ?? authSecret);

  if (env.NODE_ENV === 'production' && !hasConfiguredAuth) {
    console.error('RELAYER_AUTH_SECRET must be set in production to avoid stub auth');
    process.exit(1);
  }

  const dbPool = pool ?? (env.DATABASE_URL ? createDatabasePool(env.DATABASE_URL) : undefined);

  if (env.NODE_ENV === 'production' && !dbPool) {
    console.error('DATABASE_URL must be set in production for persistent storage');
    process.exit(1);
  }

  const resolvedNonceStore: NonceStore =
    nonceStore ?? (dbPool ? new PgNonceStore(dbPool) : new MemoryNonceStore());
  const resolvedIdempotencyStore: AnyIdempotencyStore =
    idempotencyStore ?? (dbPool ? new PgIdempotencyStore(dbPool) : new IdempotencyStore());
  const resolvedJobQueue: AnyJobQueue =
    jobQueue ?? (dbPool ? new PgJobQueue(dbPool) : new JobQueue());
  const resolvedScheduledTransferStore: AnyScheduledTransferStore =
    scheduledTransferStore ??
    (dbPool ? new PgScheduledTransferStore(dbPool) : new ScheduledTransferStore());

  const resolvedAuthService =
    authService ?? (authSecret ? createBearerAuthService(authSecret) : stubAuthService);
  const app = express();

  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'x-request-id'],
      exposedHeaders: ['X-Request-Id', 'x-request-id'],
      credentials: true,
    })
  );

  app.use(createPayloadGuardMiddleware());

  app.use(createRequestIdMiddleware());

  app.use(createRequestLoggerMiddleware());

  const useMockSubmission =
    relayOptions?.useMockSubmission === true || env.RELAYER_USE_MOCK_SUBMISSION;
  const submitter =
    transactionSubmitter ?? (useMockSubmission ? undefined : createStellarSubmitterFromEnv());

  const mockMode = useMockSubmission || !submitter;
  relayMockMode.set(mockMode ? 1 : 0);

  app.use(createMetricsCollectorMiddleware(mockMode));

  app.use(express.json());

  const relayLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.RELAY_RATE_LIMIT_MAX,
    message: 'Too many relay requests from this IP, please try again later.',
    keyGenerator: (req: Request) => {
      const callerId = (req as any).callerId;
      return callerId || req.ip;
    },
  });

  const accountLimiter = createAccountRateLimiterMiddleware();

  const statusLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.STATUS_RATE_LIMIT_MAX,
    message: 'Too many status requests from this IP, please try again later.',
  });

  const relayService = new RelayService(
    signatureService,
    resolvedJobQueue,
    resolvedIdempotencyStore,
    submitter,
    {
      useMockSubmission,
      ...relayOptions,
    },
    resolvedNonceStore
  );
  const auth = createAuthMiddleware(resolvedAuthService);
  const validate = validateBody(relayRequestSchema);
  const idempotency = createIdempotencyMiddleware(resolvedIdempotencyStore);

  const executeHandler = createExecuteRelayHandler(relayService);
  const validateHandler = createValidateRelayHandler(relayService);
  const healthHandler = createHealthHandler(relayService);

  const scheduledTransferService = new ScheduledTransferService(
    resolvedScheduledTransferStore,
    relayService
  );
  const schedulerEngine = new SchedulerEngine(scheduledTransferService, {
    pollIntervalMs: env.SCHEDULER_POLL_INTERVAL_MS,
  });

  if (relayOptions?.startScheduler !== false) {
    schedulerEngine.start();
  }

  const validateScheduledTransfer = validateBody(createScheduledTransferSchema);
  const contentTypeGuard = createContentTypeGuardMiddleware();

  app.post(
    '/relay/execute',
    auth,
    contentTypeGuard,
    relayLimiter,
    accountLimiter,
    validate,
    idempotency,
    executeHandler
  );
  app.post('/relay/validate', auth, contentTypeGuard, relayLimiter, validate, validateHandler);
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

export function createDatabasePool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // Idle-client errors are emitted on the Pool, not on a request promise.
  pool.on('error', (error) => {
    console.error('Unexpected Postgres idle-client error', error);
  });
  return pool;
}

if (require.main === module) {
  // Validate the whole environment before doing anything else, so a bad config
  // is a clear boot-time failure rather than a runtime surprise.
  void (async () => {
    const env = loadEnvOrExit();
    const pool = env.DATABASE_URL ? createDatabasePool(env.DATABASE_URL) : undefined;
    if (pool) await runMigrations(pool);
    const app = createApp(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      pool
    );
    app.listen(env.PORT, () => {
      console.log(`Relayer service listening on port ${env.PORT}`);
    });
  })().catch((error) => {
    console.error('Relayer startup failed', error);
    process.exit(1);
  });
}
