import { Request, Response } from 'express';
import type { RelayServiceContract } from '../types';

/**
 * Health check handler factory.
 *
 * Returns structured JSON with dependency status for orchestrators.
 * Responds with:
 * - 200 when all critical dependencies are healthy (status: 'ok')
 * - 503 when any critical dependency is down (status: 'degraded')
 */
export function createHealthHandler(relayService: RelayServiceContract) {
  return async (_req: Request, res: Response): Promise<void> => {
    const health = relayService.health();

    const rpcStatus = await relayService.checkRpcHealth();
    const signatureStatus = await relayService.checkSignatureServiceHealth();

    const updatedHealth = {
      ...health,
      dependencies: {
        ...health.dependencies,
        rpc: rpcStatus,
        signatureService: signatureStatus,
      },
    };

    const overallStatus =
      updatedHealth.dependencies.queue?.status === 'ok' &&
      rpcStatus.status === 'ok' &&
      updatedHealth.dependencies.storage?.status === 'ok' &&
      signatureStatus.status === 'ok'
        ? 'ok'
        : 'degraded';

    updatedHealth.status = overallStatus;

    const statusCode = overallStatus === 'ok' ? 200 : 503;
    res.status(statusCode).json(updatedHealth);
  };
}
