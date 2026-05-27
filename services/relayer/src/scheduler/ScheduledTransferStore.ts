import { randomUUID } from 'crypto';
import type {
  CreateScheduledTransferInput,
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
  ScheduledTransferStatus,
} from './types';

/**
 * In-memory store for scheduled transfers and execution logs.
 * Designed to be swapped for a persistent backend when ready.
 */
export class ScheduledTransferStore {
  private readonly transfers = new Map<string, ScheduledTransfer>();
  private readonly executions = new Map<string, ScheduledTransferExecutionLog[]>();
  private readonly accountIndex = new Map<string, Set<string>>();
  private readonly processing = new Set<string>();

  create(input: CreateScheduledTransferInput, callerId: string): ScheduledTransfer {
    const now = new Date().toISOString();
    const transfer: ScheduledTransfer = {
      id: randomUUID(),
      accountId: input.accountAddress,
      callerId,
      to: input.to,
      amount: input.amount,
      asset: input.asset,
      frequency: input.frequency,
      status: 'active',
      startAt: input.startAt,
      nextRunAt: input.startAt,
      endAt: input.endAt,
      note: input.note,
      userApprovedAt: now,
      relayPayload: input.relayPayload,
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.transfers.set(transfer.id, transfer);
    this.executions.set(transfer.id, []);

    const accountKey = this.accountKey(input.accountAddress, callerId);
    const ids = this.accountIndex.get(accountKey) ?? new Set<string>();
    ids.add(transfer.id);
    this.accountIndex.set(accountKey, ids);

    return transfer;
  }

  listByAccount(accountAddress: string, callerId: string): ScheduledTransfer[] {
    const ids = this.accountIndex.get(this.accountKey(accountAddress, callerId));
    if (!ids) return [];

    return [...ids]
      .map((id) => this.transfers.get(id))
      .filter((transfer): transfer is ScheduledTransfer => transfer !== undefined)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getById(id: string): ScheduledTransfer | undefined {
    return this.transfers.get(id);
  }

  getByIdForCaller(id: string, callerId: string): ScheduledTransfer | undefined {
    const transfer = this.transfers.get(id);
    if (!transfer || transfer.callerId !== callerId) {
      return undefined;
    }
    return transfer;
  }

  tryAcquireProcessing(id: string): boolean {
    if (this.processing.has(id)) {
      return false;
    }

    const transfer = this.transfers.get(id);
    if (!transfer || transfer.status !== 'active') {
      return false;
    }

    this.processing.add(id);
    return true;
  }

  releaseProcessing(id: string): void {
    this.processing.delete(id);
  }

  isProcessing(id: string): boolean {
    return this.processing.has(id);
  }

  updateStatus(id: string, status: ScheduledTransferStatus): ScheduledTransfer | undefined {
    const transfer = this.transfers.get(id);
    if (!transfer) return undefined;

    const updated: ScheduledTransfer = {
      ...transfer,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.transfers.set(id, updated);
    return updated;
  }

  updateAfterExecution(
    id: string,
    patch: Pick<ScheduledTransfer, 'status' | 'nextRunAt' | 'lastExecutionAt' | 'consecutiveFailures'>
  ): ScheduledTransfer | undefined {
    const transfer = this.transfers.get(id);
    if (!transfer) return undefined;

    const updated: ScheduledTransfer = {
      ...transfer,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.transfers.set(id, updated);
    return updated;
  }

  listDue(now: Date = new Date()): ScheduledTransfer[] {
    return [...this.transfers.values()].filter((transfer) => {
      if (transfer.status !== 'active' || this.processing.has(transfer.id)) {
        return false;
      }
      return new Date(transfer.nextRunAt).getTime() <= now.getTime();
    });
  }

  appendExecution(log: ScheduledTransferExecutionLog): ScheduledTransferExecutionLog {
    const existing = this.executions.get(log.scheduledTransferId) ?? [];
    existing.unshift(log);
    this.executions.set(log.scheduledTransferId, existing);
    return log;
  }

  listExecutions(scheduledTransferId: string): ScheduledTransferExecutionLog[] {
    return [...(this.executions.get(scheduledTransferId) ?? [])];
  }

  size(): number {
    return this.transfers.size;
  }

  private accountKey(accountAddress: string, callerId: string): string {
    return `${callerId}:${accountAddress}`;
  }
}
