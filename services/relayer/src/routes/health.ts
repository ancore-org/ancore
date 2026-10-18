import { Request, Response } from 'express';
import type { Pool } from 'pg';
import type { RelayServiceContract } from '../types';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

/**
 * Health check handler factory.
 *
 * Returns structured JSON with dependency status for orchestrators.
 * Responds with:
 * - 200 when all critical dependencies are healthy (status: 'ok')
 * - 503 when any critical dependency is down (status: 'degraded')
 */
export function createHealthHandler(relayService: RelayServiceContract, dbPool?: Pool) {
  return async (_req: Request, res: Response): Promise<void> => {
    const health = relayService.health();

    const rpcStatus = await relayService.checkRpcHealth();
    const signatureStatus = await relayService.checkSignatureServiceHealth();

    let databaseStatus: DatabaseHealthStatus | undefined;
    if (dbPool) {
      const start = Date.now();
      try {
        let timer: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Database ping timed out after 2000ms')), 2000);
        });

        const queryPromise = dbPool.query('SELECT 1').then((result) => {
          if (timer) clearTimeout(timer);
          return result;
        });

        await Promise.race([queryPromise, timeoutPromise]);
        databaseStatus = {
          status: 'healthy',
          latencyMs: Date.now() - start,
        };
      } catch (err: any) {
        databaseStatus = {
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          message: err?.message || 'Database query failed',
        };
      }
    }

    const updatedHealth = {
      ...health,
      dependencies: {
        ...health.dependencies,
        rpc: rpcStatus,
        signatureService: signatureStatus,
        ...(databaseStatus ? { database: databaseStatus } : {}),
      },
    };

    const isDatabaseHealthy = !databaseStatus || databaseStatus.status === 'healthy';

    const overallStatus =
      updatedHealth.dependencies.queue?.status === 'ok' &&
      rpcStatus.status === 'ok' &&
      updatedHealth.dependencies.storage?.status === 'ok' &&
      signatureStatus.status === 'ok' &&
      isDatabaseHealthy
        ? 'ok'
        : 'degraded';

    updatedHealth.status = overallStatus;

    const statusCode = overallStatus === 'ok' ? 200 : 503;
    res.status(statusCode).json(updatedHealth);
  };
}
