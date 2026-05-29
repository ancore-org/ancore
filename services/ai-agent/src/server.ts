import express, { Express, Request, Response } from 'express';

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

  return app;
}
