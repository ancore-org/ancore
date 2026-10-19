import { Request, Response } from 'express';
import type { Pool } from 'pg';
import type { RelayServiceContract } from '../types';
import type { DependencyStatus } from '../types';

const DB_PING_TIMEOUT_MS = 2_000;

async function checkDatabaseHealth(pool: Pool): Promise<DependencyStatus> {
  let client: Awaited<ReturnType<Pool['connect']>> | undefined;
  try {
    client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB ping timed out')), DB_PING_TIMEOUT_MS)
      ),
    ]);
    await client.query('SELECT 1');
    return { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown database error';
    return { status: 'degraded', message };
  } finally {
    client?.release();
  }
}

/**
 * Health check handler factory.
 *
 * Returns structured JSON with dependency status for orchestrators.
 * Responds with:
 * - 200 when all critical dependencies are healthy (status: 'ok')
 * - 503 when any critical dependency is down (status: 'degraded')
 *
 * When `dbPool` is provided, executes a live SELECT 1 probe with a 2-second
 * timeout (#1528). The result appears as `dependencies.database` in the
 * response body.
 */
export function createHealthHandler(relayService: RelayServiceContract, dbPool?: Pool) {
  return async (_req: Request, res: Response): Promise<void> => {
    const health = relayService.health();

    const rpcStatus = await relayService.checkRpcHealth();
    const signatureStatus = await relayService.checkSignatureServiceHealth();
    const databaseStatus: DependencyStatus | undefined = dbPool
      ? await checkDatabaseHealth(dbPool)
      : undefined;

    const updatedHealth = {
      ...health,
      dependencies: {
        ...health.dependencies,
        rpc: rpcStatus,
        signatureService: signatureStatus,
        ...(databaseStatus ? { database: databaseStatus } : {}),
      },
    };

    const databaseOk = databaseStatus ? databaseStatus.status === 'ok' : true;

    const overallStatus =
      updatedHealth.dependencies.queue?.status === 'ok' &&
      rpcStatus.status === 'ok' &&
      updatedHealth.dependencies.storage?.status === 'ok' &&
      signatureStatus.status === 'ok' &&
      databaseOk
        ? 'ok'
        : 'degraded';

    updatedHealth.status = overallStatus;

    const statusCode = overallStatus === 'ok' ? 200 : 503;
    res.status(statusCode).json(updatedHealth);
  };
}
