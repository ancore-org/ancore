import express, { Express, Request, Response } from 'express';
import { intentSchema, HIGH_VALUE_PAYMENT_THRESHOLD } from './schemas/intent';
import { requestLogger } from './middleware/request-logger';

const startTime = Date.now();

/**
 * Determines if a payment intent requires confirmation based on amount.
 * High-value payments (e.g., >100 USDC or >1000 XLM) require confirmation.
 */
function requiresConfirmation(intent: any): boolean {
  if (intent.type === 'payment') {
    const amount = parseFloat(intent.amount);
    const threshold = intent.asset === 'USDC' ? 100 : 1000;
    return amount > threshold;
  }
  return false;
}

/**
 * App factory — exported for testing.
 *
 * Creates and configures the Express application for the AI Agent service.
 * MVP routes: health, draft-intent, and intent validation (draft-only; no execution).
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use(requestLogger);

  // ── Health endpoint ────────────────────────────────────────────────────────
  // Used by the Docker HEALTHCHECK and load-balancer probes.
  // Returns HTTP 200 while the process is running.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      service: 'ai-agent',
      version: process.env['SERVICE_VERSION'] ?? '0.1.0',
    });
  });

  // ── Draft Intent endpoint ──────────────────────────────────────────────────
  app.post('/agent/draft-intent', (req: Request, res: Response) => {
    const { prompt, accountId } = req.body;
    if (!prompt || !accountId) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    const isInvoice = typeof prompt === 'string' && prompt.toLowerCase().includes('invoice');
    return res.status(200).json({
      status: 'draft',
      requiresConfirmation: true,
      summary: isInvoice ? 'Drafted invoice intent' : 'Drafted payment intent',
      intent: {
        type: isInvoice ? 'invoice' : 'payment',
        destination: 'G123',
        amount: '10',
        asset: 'XLM',
      },
    });
  });

  // ── Intent validation ──────────────────────────────────────────────────────
  // Validates intent payloads against Zod schemas.
  // No LLM or external service call — purely structural validation.
  app.post('/v1/intents/validate', (req: Request, res: Response) => {
    const parsed = intentSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }
      return res.status(400).json({ errors: { fieldErrors } });
    }

    const intent = parsed.data;
    let requiresConfirmation = false;

    // Flag high-value payments for confirmation
    if (intent.type === 'payment') {
      const amount = parseFloat(intent.amount);
      requiresConfirmation = amount >= HIGH_VALUE_PAYMENT_THRESHOLD;
    }

    return res.status(200).json({
      valid: true,
      intent: parsed.data,
      requiresConfirmation,
    });
  });

  return app;
}
