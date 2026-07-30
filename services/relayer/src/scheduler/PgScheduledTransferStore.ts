/**
 * PostgreSQL-backed implementation of the ScheduledTransferStore interface.
 *
 * Replaces the in-memory Map store with durable Postgres tables defined in
 * migration 002_scheduled_transfers.sql.  All public methods are drop-in
 * replacements for the in-memory version; the ScheduledTransferService and
 * SchedulerEngine do not need to change.
 *
 * Distributed lease locking (tryAcquireLease / releaseLease) prevents two
 * worker instances from executing the same transfer concurrently without
 * relying on an in-process Set.  Expired leases are stolen automatically.
 */

import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import type {
  CreateScheduledTransferInput,
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
  ScheduledTransferStatus,
} from './types';

const LEASE_TTL_MS = 30_000; // 30 s; must exceed max relay round-trip time

function rowToTransfer(row: Record<string, unknown>): ScheduledTransfer {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    callerId: row.caller_id as string,
    to: row.to_address as string,
    amount: row.amount as string,
    asset: row.asset as string,
    frequency: row.frequency as ScheduledTransfer['frequency'],
    status: row.status as ScheduledTransferStatus,
    startAt: (row.start_at as Date).toISOString(),
    nextRunAt: (row.next_run_at as Date).toISOString(),
    endAt: row.end_at ? (row.end_at as Date).toISOString() : undefined,
    note: row.note as string | undefined,
    userApprovedAt: (row.user_approved_at as Date).toISOString(),
    relayPayload: row.relay_payload as ScheduledTransfer['relayPayload'],
    consecutiveFailures: row.consecutive_failures as number,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    lastExecutionAt: row.last_execution_at
      ? (row.last_execution_at as Date).toISOString()
      : undefined,
  };
}

function rowToExecution(row: Record<string, unknown>): ScheduledTransferExecutionLog {
  return {
    id: row.id as string,
    scheduledTransferId: row.scheduled_transfer_id as string,
    executedAt: (row.executed_at as Date).toISOString(),
    outcome: row.outcome as 'success' | 'failed',
    transactionId: row.transaction_id as string | undefined,
    error: row.error as string | undefined,
  };
}

export class PgScheduledTransferStore {
  private readonly workerId = randomUUID();

  constructor(private readonly pool: Pool) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async create(input: CreateScheduledTransferInput, callerId: string): Promise<ScheduledTransfer> {
    const now = new Date();
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO scheduled_transfers
         (account_id, caller_id, to_address, amount, asset, frequency,
          start_at, next_run_at, end_at, note, relay_payload, user_approved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        input.accountAddress,
        callerId,
        input.to,
        input.amount,
        input.asset,
        input.frequency,
        new Date(input.startAt),
        new Date(input.startAt),
        input.endAt ? new Date(input.endAt) : null,
        input.note ?? null,
        JSON.stringify(input.relayPayload),
        now,
      ]
    );
    return rowToTransfer(result.rows[0]);
  }

  async listByAccount(accountAddress: string, callerId: string): Promise<ScheduledTransfer[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scheduled_transfers
       WHERE account_id = $1 AND caller_id = $2
       ORDER BY created_at DESC`,
      [accountAddress, callerId]
    );
    return result.rows.map(rowToTransfer);
  }

  async getById(id: string): Promise<ScheduledTransfer | undefined> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scheduled_transfers WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? rowToTransfer(result.rows[0]) : undefined;
  }

  async getByIdForCaller(id: string, callerId: string): Promise<ScheduledTransfer | undefined> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scheduled_transfers WHERE id = $1 AND caller_id = $2`,
      [id, callerId]
    );
    return result.rows[0] ? rowToTransfer(result.rows[0]) : undefined;
  }

  async updateStatus(
    id: string,
    status: ScheduledTransferStatus
  ): Promise<ScheduledTransfer | undefined> {
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE scheduled_transfers
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] ? rowToTransfer(result.rows[0]) : undefined;
  }

  async updateAfterExecution(
    id: string,
    patch: Pick<
      ScheduledTransfer,
      'status' | 'nextRunAt' | 'lastExecutionAt' | 'consecutiveFailures'
    >
  ): Promise<ScheduledTransfer | undefined> {
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE scheduled_transfers
       SET status = $1,
           next_run_at = $2,
           last_execution_at = $3,
           consecutive_failures = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        patch.status,
        new Date(patch.nextRunAt),
        patch.lastExecutionAt ? new Date(patch.lastExecutionAt) : null,
        patch.consecutiveFailures,
        id,
      ]
    );
    return result.rows[0] ? rowToTransfer(result.rows[0]) : undefined;
  }

  async listDue(now: Date): Promise<ScheduledTransfer[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT st.* FROM scheduled_transfers st
       LEFT JOIN scheduled_transfer_leases stl
         ON stl.transfer_id = st.id AND stl.expires_at > NOW()
       WHERE st.status = 'active'
         AND st.next_run_at <= $1
         AND stl.transfer_id IS NULL
       ORDER BY st.next_run_at ASC`,
      [now]
    );
    return result.rows.map(rowToTransfer);
  }

  // ── Distributed lease locking ────────────────────────────────────────────────

  /**
   * Atomically acquire a lease for a transfer.
   * Steals any expired lease automatically (upsert with expiry check).
   * Returns true if this worker now holds the lease.
   */
  async tryAcquireLease(id: string): Promise<boolean> {
    const expiresAt = new Date(Date.now() + LEASE_TTL_MS);
    const result = await this.pool.query(
      `INSERT INTO scheduled_transfer_leases (transfer_id, worker_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (transfer_id) DO UPDATE
         SET worker_id = EXCLUDED.worker_id,
             acquired_at = NOW(),
             expires_at = EXCLUDED.expires_at
         WHERE scheduled_transfer_leases.expires_at < NOW()
       RETURNING worker_id`,
      [id, this.workerId, expiresAt]
    );
    // If the INSERT/UPDATE succeeded and we own the row, we got the lease
    if (!result.rowCount || result.rowCount === 0) return false;
    return (result.rows[0] as { worker_id: string }).worker_id === this.workerId;
  }

  async releaseLease(id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM scheduled_transfer_leases WHERE transfer_id = $1 AND worker_id = $2`,
      [id, this.workerId]
    );
  }

  // Compatibility shims for ScheduledTransferService (which uses the in-memory version)
  tryAcquireProcessing(id: string): Promise<boolean> {
    return this.tryAcquireLease(id);
  }

  releaseProcessing(id: string): Promise<void> {
    return this.releaseLease(id);
  }

  // ── Execution logs ───────────────────────────────────────────────────────────

  async appendExecution(
    log: Omit<ScheduledTransferExecutionLog, 'id'>
  ): Promise<ScheduledTransferExecutionLog> {
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO scheduled_transfer_executions
         (scheduled_transfer_id, executed_at, outcome, transaction_id, error)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        log.scheduledTransferId,
        new Date(log.executedAt),
        log.outcome,
        log.transactionId ?? null,
        log.error ?? null,
      ]
    );
    return rowToExecution(result.rows[0]);
  }

  async listExecutions(scheduledTransferId: string): Promise<ScheduledTransferExecutionLog[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scheduled_transfer_executions
       WHERE scheduled_transfer_id = $1
       ORDER BY executed_at DESC
       LIMIT 50`,
      [scheduledTransferId]
    );
    return result.rows.map(rowToExecution);
  }

  // ── Failure notifications ────────────────────────────────────────────────────

  async recordFailureNotification(
    transferId: string,
    notificationType: string,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO scheduled_transfer_notifications
         (scheduled_transfer_id, notification_type, payload)
       VALUES ($1, $2, $3)`,
      [transferId, notificationType, JSON.stringify(payload)]
    );
  }
}
