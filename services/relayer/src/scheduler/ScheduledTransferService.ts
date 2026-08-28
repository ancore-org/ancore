import { randomUUID } from 'crypto';
import type { RelayServiceContract } from '../types';
import type { RelayExecuteRequest } from '../types';
import { nextRetryAfter } from '../queue/backoff';
import { ScheduledTransferStore } from './ScheduledTransferStore';
import type { PgScheduledTransferStore } from './PgScheduledTransferStore';
import { computeNextRunAt, isDue } from './schedule-utils';
import { schedulerMaxFailuresReached } from '../metrics';
import { rootLogger } from '../logging/logger';
import type {
  CreateScheduledTransferInput,
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
} from './types';

const MAX_CONSECUTIVE_FAILURES = 5;

export type AnyScheduledTransferStore = ScheduledTransferStore | PgScheduledTransferStore;

/**
 * FailureNotifier is called when a recurring transfer reaches a notable failure
 * threshold.  Implementations may send push notifications, emails, webhooks, etc.
 */
export interface FailureNotifier {
  onConsecutiveFailure(transfer: ScheduledTransfer, failureCount: number): Promise<void>;
  onMaxFailuresReached(transfer: ScheduledTransfer): Promise<void>;
}

export class ScheduledTransferService {
  constructor(
    private readonly store: AnyScheduledTransferStore,
    private readonly relayService: RelayServiceContract,
    private readonly notifier?: FailureNotifier
  ) {}

  async create(input: CreateScheduledTransferInput, callerId: string): Promise<ScheduledTransfer> {
    return this.store.create(input, callerId);
  }

  async list(accountAddress: string, callerId: string): Promise<ScheduledTransfer[]> {
    return this.store.listByAccount(accountAddress, callerId);
  }

  async get(id: string, callerId: string): Promise<ScheduledTransfer | undefined> {
    return this.store.getByIdForCaller(id, callerId);
  }

  async pause(id: string, callerId: string): Promise<ScheduledTransfer | undefined> {
    const transfer = await this.store.getByIdForCaller(id, callerId);
    if (!transfer || transfer.status !== 'active') {
      return undefined;
    }
    return this.store.updateStatus(id, 'paused');
  }

  async cancel(id: string, callerId: string): Promise<ScheduledTransfer | undefined> {
    const transfer = await this.store.getByIdForCaller(id, callerId);
    if (
      !transfer ||
      transfer.status === 'cancelled' ||
      transfer.status === 'completed' ||
      transfer.status === 'failed'
    ) {
      return undefined;
    }
    return this.store.updateStatus(id, 'cancelled');
  }

  async listExecutions(id: string, callerId: string): Promise<ScheduledTransferExecutionLog[]> {
    const transfer = await this.store.getByIdForCaller(id, callerId);
    if (!transfer) {
      return [];
    }
    return this.store.listExecutions(id);
  }

  /**
   * Execute all due scheduled transfers via the relayer pipeline.
   * Acquires a distributed lease per transfer to prevent double-execution
   * across concurrent worker instances.
   */
  async processDueTransfers(now: Date = new Date()): Promise<number> {
    const due = await this.store.listDue(now);
    let processed = 0;

    for (const transfer of due) {
      if (!isDue(transfer.nextRunAt, now)) {
        continue;
      }

      const acquired = await this.store.tryAcquireProcessing(transfer.id);
      if (!acquired) {
        continue;
      }

      try {
        await this.executeTransfer(transfer, now);
        processed++;
      } catch (err) {
        // A single transfer must not abort the whole scheduler pass; otherwise
        // one persistently failing transfer blocks every later due transfer.
        rootLogger.error(
          {
            scheduledTransferId: transfer.id,
            outcome: 'error',
            error: err instanceof Error ? err.message : String(err),
          },
          'scheduled transfer execution threw'
        );
      } finally {
        await this.store.releaseProcessing(transfer.id);
      }
    }

    return processed;
  }

  private async executeTransfer(transfer: ScheduledTransfer, now: Date): Promise<void> {
    const relayRequest: RelayExecuteRequest = {
      sessionKey: transfer.relayPayload.sessionKey,
      operation: transfer.relayPayload.operation,
      parameters: transfer.relayPayload.parameters,
      signature: transfer.relayPayload.signature,
      nonce: transfer.relayPayload.nonce,
    };

    const response = await this.relayService.executeRelay(relayRequest);
    const executedAt = now.toISOString();

    const log: ScheduledTransferExecutionLog = {
      id: randomUUID(),
      scheduledTransferId: transfer.id,
      executedAt,
      outcome: response.success ? 'success' : 'failed',
      transactionId: response.transactionId,
      error: response.error?.message,
    };

    await this.store.appendExecution(log);

    if (!response.success) {
      const consecutiveFailures = transfer.consecutiveFailures + 1;

      if (transfer.frequency === 'once') {
        await this.store.updateAfterExecution(transfer.id, {
          status: 'completed',
          nextRunAt: transfer.nextRunAt,
          lastExecutionAt: executedAt,
          consecutiveFailures,
        });
        return;
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await this.store.updateAfterExecution(transfer.id, {
          status: 'failed',
          nextRunAt: transfer.nextRunAt,
          lastExecutionAt: executedAt,
          consecutiveFailures,
        });

        schedulerMaxFailuresReached.inc();

        // Notify: max failures reached, transfer terminated
        if (this.notifier) {
          await this.notifier.onMaxFailuresReached(transfer).catch(() => {});
        }
        if ('recordFailureNotification' in this.store) {
          await (this.store as PgScheduledTransferStore)
            .recordFailureNotification(transfer.id, 'max_failures_reached', {
              consecutiveFailures,
              error: response.error?.message,
            })
            .catch(() => {});
        }
        return;
      }

      await this.store.updateAfterExecution(transfer.id, {
        status: 'active',
        nextRunAt: nextRetryAfter(consecutiveFailures - 1, now),
        lastExecutionAt: executedAt,
        consecutiveFailures,
      });

      // Notify on every consecutive failure (above threshold 1 to avoid noise)
      if (consecutiveFailures > 1 && this.notifier) {
        await this.notifier.onConsecutiveFailure(transfer, consecutiveFailures).catch(() => {});
      }
      if (consecutiveFailures > 1 && 'recordFailureNotification' in this.store) {
        await (this.store as PgScheduledTransferStore)
          .recordFailureNotification(transfer.id, 'consecutive_failure', {
            consecutiveFailures,
            error: response.error?.message,
          })
          .catch(() => {});
      }
      return;
    }

    const nextRunAt = computeNextRunAt(
      now,
      transfer.frequency,
      transfer.endAt ? new Date(transfer.endAt) : undefined
    );

    if (nextRunAt) {
      await this.store.updateAfterExecution(transfer.id, {
        status: 'active',
        nextRunAt: nextRunAt.toISOString(),
        lastExecutionAt: executedAt,
        consecutiveFailures: 0,
      });
    } else {
      await this.store.updateAfterExecution(transfer.id, {
        status: 'completed',
        nextRunAt: transfer.nextRunAt,
        lastExecutionAt: executedAt,
        consecutiveFailures: 0,
      });
    }
  }
}
