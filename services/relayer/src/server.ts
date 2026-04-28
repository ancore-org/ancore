import express, { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { RelayService } from './services/relayService';
import { createAuthMiddleware } from './middleware/auth';
import { createIdempotencyMiddleware } from './middleware/idempotency';
import { validateBody } from './validation/middleware';
import { createExecuteRelayHandler } from './handlers/executeRelay';
import { createValidateRelayHandler } from './handlers/validateRelay';
import { IdempotencyStore } from './store/idempotency';
import type { AuthServiceContract, SignatureServiceContract } from './types';

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

const stubSignatureService: SignatureServiceContract = {
  verify(_publicKey: string, _payload: string, _signature: string): boolean {
    // TODO: replace with real Ed25519 verification (e.g. @noble/ed25519)
    return true;
  },
};

// ── App factory (exported for testing) ───────────────────────────────────────

export function createApp(
  authService: AuthServiceContract = stubAuthService,
  signatureService: SignatureServiceContract = stubSignatureService,
  idempotencyStore: IdempotencyStore = new IdempotencyStore()
): Express {
  const app = express();
  app.use(express.json());

  // Rate limiting for relay operations
  const relayLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RELAY_RATE_LIMIT_MAX ? parseInt(process.env.RELAY_RATE_LIMIT_MAX) : 50, // limit each IP to 50 requests per windowMs
    message: 'Too many relay requests from this IP, please try again later.',
    keyGenerator: (req) => {
      // If authenticated, use callerId, else use IP
      const callerId = (req as any).callerId;
      return callerId || req.ip;
    },
  });

  // Rate limiting for status
  const statusLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.STATUS_RATE_LIMIT_MAX ? parseInt(process.env.STATUS_RATE_LIMIT_MAX) : 200, // higher limit for status
    message: 'Too many status requests from this IP, please try again later.',
  });

  const relayService = new RelayService(signatureService);
  const auth = createAuthMiddleware(authService);
  const validate = validateBody(relayRequestSchema);
  const idempotency = createIdempotencyMiddleware(idempotencyStore);

  const executeHandler = createExecuteRelayHandler(relayService);
  const validateHandler = createValidateRelayHandler(relayService);

  app.post('/relay/execute', auth, relayLimiter, validate, idempotency, executeHandler);
  app.post('/relay/validate', auth, relayLimiter, validate, validateHandler);
  app.get('/relay/status', statusLimiter, (_req, res) => res.json(relayService.health()));

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
