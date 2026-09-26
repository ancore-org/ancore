import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { log } from '../logging/logger';

const API_KEY_HEADER = 'x-api-key';

function getConfiguredApiKey(): string | undefined {
  const key = process.env['AI_AGENT_API_KEY'];
  return key && key.length > 0 ? key : undefined;
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffers of different length would throw in timingSafeEqual; the length
  // check below is itself not constant-time, but leaking the *length* of a
  // secret comparison is an accepted, standard trade-off for this API.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Requires a valid `x-api-key` header on every request it guards.
 *
 * GUARDRAIL: fails closed. If AI_AGENT_API_KEY isn't configured in the
 * environment, every request is rejected with 503 rather than silently
 * passing through unauthenticated — this service invokes a paid third-party
 * LLM API with its own credentials and must never be reachable without auth.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void | Response {
  const configuredKey = getConfiguredApiKey();
  if (!configuredKey) {
    log.error({ path: req.path }, 'ai_agent_api_key_not_configured');
    return res.status(503).json({ error: 'Service unavailable: authentication is not configured' });
  }

  const provided = req.header(API_KEY_HEADER);
  if (!provided || !timingSafeCompare(provided, configuredKey)) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid API key' });
  }

  next();
}
