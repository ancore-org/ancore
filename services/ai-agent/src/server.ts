import express, { Express, Request, Response } from 'express';
import { intentSchema, HIGH_VALUE_PAYMENT_THRESHOLD } from './schemas/intent';
import { requestLogger } from './middleware/request-logger';
import { draftIntentRateLimiter } from './middleware/rate-limiter';
import { requireApiKey } from './middleware/auth';
import { scoreRisk } from './risk';
import { generateDraftIntent } from './draft-intent';
import { enforceNoAutonomousExecution } from './guardrail';
import { redactSecrets } from './logging/redact-secrets';
import { log } from './logging/logger';
import type { DraftIntentResponse } from './types';

const MAX_PROMPT_LENGTH = 2000;
const MAX_ACCOUNT_ID_LENGTH = 128;

const startTime = Date.now();

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
  // LLM-backed (Claude Haiku, env-gated) with a deterministic offline fallback.
  // GUARDRAIL: every response is validated by enforceNoAutonomousExecution()
  // before it is returned — a violation is a 500, never a silent pass-through.
  app.post(
    '/agent/draft-intent',
    requireApiKey,
    draftIntentRateLimiter,
    async (req: Request, res: Response) => {
      const { prompt, accountId } = req.body;
      if (!prompt || !accountId || typeof prompt !== 'string' || typeof accountId !== 'string') {
        return res.status(400).json({ error: 'Invalid request: prompt and accountId required' });
      }

      if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(413).json({
          error: `Prompt exceeds maximum length limit of ${MAX_PROMPT_LENGTH} characters`,
        });
      }

      if (accountId.length > MAX_ACCOUNT_ID_LENGTH) {
        return res.status(400).json({
          error: `accountId exceeds maximum length limit of ${MAX_ACCOUNT_ID_LENGTH} characters`,
        });
      }

      try {
        const { intent, summary, source } = await generateDraftIntent({ prompt, accountId });
        const risk = scoreRisk(intent);

        const response = {
          status: 'draft' as const,
          requiresConfirmation: true as const,
          summary,
          intent,
          risk,
          source,
        };

        // Fail closed: never return a response that hasn't passed the guardrail.
        enforceNoAutonomousExecution(response as unknown as DraftIntentResponse);

        log.info(
          {
            timestamp: new Date().toISOString(),
            accountId,
            source,
            intentType: intent.type,
            riskLevel: risk.level,
            promptRedacted: redactSecrets(prompt),
          },
          'draft_intent_audit'
        );

        return res.status(200).json(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error({ accountId, error: message }, 'draft_intent_failed');

        if (/destination/i.test(message)) {
          return res.status(400).json({
            error: 'Needs clarification',
            message: 'Please specify a Stellar destination address for the payment intent.',
          });
        }

        return res.status(500).json({ error: 'Failed to draft intent' });
      }
    }
  );

  // ── Intent validation ──────────────────────────────────────────────────────
  // Validates intent payloads against Zod schemas.
  // No LLM or external service call — purely structural validation.
  app.post('/v1/intents/validate', requireApiKey, (req: Request, res: Response) => {
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

    if (intent.type === 'payment') {
      const amount = parseFloat(intent.amount);
      requiresConfirmation = amount >= HIGH_VALUE_PAYMENT_THRESHOLD;
    }

    const risk = scoreRisk(intent);

    return res.status(200).json({
      valid: true,
      intent: parsed.data,
      requiresConfirmation,
      risk,
    });
  });

  return app;
}
