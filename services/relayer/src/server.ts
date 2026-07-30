// Tracing must be imported first to register the OpenTelemetry SDK before
// any other module creates spans or instruments HTTP traffic.
import './tracing';

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { TransferPolicySchema } from '@ancore/types';
import { loadEnvOrExit } from './config/env';
import { RelayService } from './services/relayService';
import { createStellarSubmitterFromEnv } from './services/stellarSubmitter';
import { createAuthMiddleware } from './middleware/auth';
import { createAccountRateLimiterMiddleware } from './middleware/accountRateLimiter';
import { createIdempotencyMiddleware } from './middleware/idempotency';
import { createPayloadGuardMiddleware } from './middleware/payloadGuard';
import { createRequestLoggerMiddleware } from './middleware/requestLogger';
import { createRequestIdMiddleware } from './middleware/requestId';
import { createMetricsCollectorMiddleware, relayMockMode } from './middleware/metricsCollector';
import { renderPrometheusMetrics } from './metrics';
import { validateBody } from './validation/middleware';
import { createExecuteRelayHandler } from './handlers/executeRelay';
import { createValidateRelayHandler } from './handlers/validateRelay';
import { createHealthHandler } from './routes/health';
import { IdempotencyStore } from './store/idempotency';
import { MemoryNonceStore, type NonceStore } from './store/nonceStore';
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
  idempotencyStore: IdempotencyStore = new IdempotencyStore(),
  transactionSubmitter?: TransactionSubmitterContract,
  relayOptions?: RelayServiceOptions,
  nonceStore: NonceStore = new MemoryNonceStore()
): Express {
  // Fail fast on misconfiguration before any middleware or listener is wired up.
  const env = loadEnvOrExit();

  const authSecret = env.RELAYER_AUTH_SECRET;
  const hasConfiguredAuth = Boolean(authService ?? authSecret);

  if (env.NODE_ENV === 'production' && !hasConfiguredAuth) {
    console.error('RELAYER_AUTH_SECRET must be set in production to avoid stub auth');
    process.exit(1);
  }

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
    pollIntervalMs: env.SCHEDULER_POLL_INTERVAL_MS,
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

if (require.main === module) {
  // Validate the whole environment before doing anything else, so a bad config
  // is a clear boot-time failure rather than a runtime surprise.
  const { PORT } = loadEnvOrExit();
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Relayer service listening on port ${PORT}`);
  });
}
