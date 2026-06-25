import { randomUUID } from 'crypto';
import type { RelayServiceContract } from '../types';
import type { RelayExecuteRequest } from '../types';
import { nextRetryAfter } from '../queue/backoff';
import { ScheduledTransferStore } from './ScheduledTransferStore';
import { computeNextRunAt, isDue } from './schedule-utils';
import type {
  CreateScheduledTransferInput,
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
} from './types';

const MAX_CONSECUTIVE_FAILURES = 5;

export class ScheduledTransferService {
  constructor(
    private readonly store: ScheduledTransferStore,
    private readonly relayService: RelayServiceContract
  ) {}

  create(input: CreateScheduledTransferInput, callerId: string): ScheduledTransfer {
    return this.store.create(input, callerId);
  }

  list(accountAddress: string, callerId: string): ScheduledTransfer[] {
    return this.store.listByAccount(accountAddress, callerId);
  }

  get(id: string, callerId: string): ScheduledTransfer | undefined {
    return this.store.getByIdForCaller(id, callerId);
  }

  pause(id: string, callerId: string): ScheduledTransfer | undefined {
    const transfer = this.store.getByIdForCaller(id, callerId);
    if (!transfer || transfer.status !== 'active') {
      return undefined;
    }
    return this.store.updateStatus(id, 'paused');
  }

  cancel(id: string, callerId: string): ScheduledTransfer | undefined {
    const transfer = this.store.getByIdForCaller(id, callerId);
    if (!transfer || transfer.status === 'cancelled' || transfer.status === 'completed') {
      return undefined;
    }
    return this.store.updateStatus(id, 'cancelled');
  }

  listExecutions(id: string, callerId: string): ScheduledTransferExecutionLog[] {
    const transfer = this.store.getByIdForCaller(id, callerId);
    if (!transfer) {
      return [];
    }
    return this.store.listExecutions(id);
  }

  /**
   * Execute all due scheduled transfers via the relayer pipeline.
   */
  async processDueTransfers(now: Date = new Date()): Promise<number> {
    const due = this.store.listDue(now);
    let processed = 0;

    for (const transfer of due) {
      if (!isDue(transfer.nextRunAt, now)) {
        continue;
      }

      if (!this.store.tryAcquireProcessing(transfer.id)) {
        continue;
      }

      try {
        await this.executeTransfer(transfer, now);
        processed++;
      } finally {
        this.store.releaseProcessing(transfer.id);
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

    this.store.appendExecution(log);

    if (!response.success) {
      const consecutiveFailures = transfer.consecutiveFailures + 1;

      if (transfer.frequency === 'once') {
        this.store.updateAfterExecution(transfer.id, {
          status: 'completed',
          nextRunAt: transfer.nextRunAt,
          lastExecutionAt: executedAt,
          consecutiveFailures,
        });
        return;
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.store.updateAfterExecution(transfer.id, {
          status: 'completed',
          nextRunAt: transfer.nextRunAt,
          lastExecutionAt: executedAt,
          consecutiveFailures,
        });
        return;
      }

      this.store.updateAfterExecution(transfer.id, {
        status: 'active',
        nextRunAt: nextRetryAfter(consecutiveFailures - 1, now),
        lastExecutionAt: executedAt,
        consecutiveFailures,
      });
      return;
    }

    const nextRunAt = computeNextRunAt(
      now,
      transfer.frequency,
      transfer.endAt ? new Date(transfer.endAt) : undefined
    );

    if (nextRunAt) {
      this.store.updateAfterExecution(transfer.id, {
        status: 'active',
        nextRunAt: nextRunAt.toISOString(),
        lastExecutionAt: executedAt,
        consecutiveFailures: 0,
      });
    } else {
      this.store.updateAfterExecution(transfer.id, {
        status: 'completed',
        nextRunAt: transfer.nextRunAt,
        lastExecutionAt: executedAt,
        consecutiveFailures: 0,
      });
    }
  }
}
