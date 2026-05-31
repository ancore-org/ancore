import express, { Express, Request, Response } from 'express';
import { intentSchema } from './schemas/intent';

const startTime = Date.now();

/**
 * App factory — exported for testing.
 *
 * Creates and configures the Express application for the AI Agent service.
 * The service is currently a scaffold; the health endpoint is the only
 * implemented route. Additional routes will be added as the AI workflow
 * orchestration features are built out.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

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

  // ── Intent validation ──────────────────────────────────────────────────────
  // Validates intent payloads against Zod schemas.
  // No LLM or external service call — purely structural validation.
  app.post('/v1/intents/validate', (req: Request, res: Response) => {
    const parsed = intentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten() });
    }
    return res.status(200).json({ valid: true, intent: parsed.data });
  });

  // ── Draft intent endpoint ───────────────────────────────────────────────────
  // Creates a draft intent from natural language prompt.
  // Returns payment or invoice intent based on prompt content.
  app.post('/agent/draft-intent', (req: Request, res: Response) => {
    const { prompt, accountId } = req.body;

    if (!prompt || !accountId) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const isInvoice = typeof prompt === 'string' && prompt.toLowerCase().includes('invoice');

    return res.status(200).json({
      status: 'draft',
      requiresConfirmation: true,
      intent: { type: isInvoice ? 'invoice' : 'payment' },
      summary: `Draft ${isInvoice ? 'invoice' : 'payment'} intent created`,
    });
  });

  return app;
}
