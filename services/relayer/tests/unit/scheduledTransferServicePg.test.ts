/**
 * Unit tests for ScheduledTransferService with the async PgScheduledTransferStore API.
 *
 * Tests lease locking, failure notification callbacks, and metric recording.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledTransferService } from '../../src/scheduler/ScheduledTransferService';
import type { FailureNotifier } from '../../src/scheduler/ScheduledTransferService';
import type { AnyScheduledTransferStore } from '../../src/scheduler/ScheduledTransferService';
import type { ScheduledTransfer, ScheduledTransferExecutionLog } from '../../src/scheduler/types';
import type { RelayServiceContract } from '../../src/types';

// ── Minimal mock store (async interface matching PgScheduledTransferStore) ──────

function makeTransfer(overrides: Partial<ScheduledTransfer> = {}): ScheduledTransfer {
  const now = new Date().toISOString();
  return {
    id: 'xfer-1',
    accountId: 'GACCOUNT',
    callerId: 'caller-1',
    to: 'GDEST',
    amount: '50',
    asset: 'XLM',
    frequency: 'monthly',
    status: 'active',
    startAt: now,
    nextRunAt: new Date(Date.now() - 1000).toISOString(),
    userApprovedAt: now,
    relayPayload: {
      sessionKey: 'aa'.repeat(32),
      operation: 'relay_execute',
      parameters: {},
      signature: 'bb'.repeat(64),
      nonce: 0,
    },
    consecutiveFailures: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeAsyncStore(transfers: ScheduledTransfer[]): AnyScheduledTransferStore {
  return {
    create: vi.fn().mockResolvedValue(transfers[0]),
    listByAccount: vi.fn().mockResolvedValue(transfers),
    getByIdForCaller: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(transfers.find((t) => t.id === id))
    ),
    updateStatus: vi.fn().mockImplementation((id: string, status: string) =>
      Promise.resolve({ ...transfers.find((t) => t.id === id)!, status })
    ),
    updateAfterExecution: vi.fn().mockResolvedValue(undefined),
    listDue: vi.fn().mockResolvedValue(transfers.filter((t) => t.status === 'active')),
    tryAcquireProcessing: vi.fn().mockResolvedValue(true),
    releaseProcessing: vi.fn().mockResolvedValue(undefined),
    appendExecution: vi.fn().mockResolvedValue(undefined),
    listExecutions: vi.fn().mockResolvedValue([]),
    recordFailureNotification: vi.fn().mockResolvedValue(undefined),
  } as unknown as AnyScheduledTransferStore;
}

function makeRelayService(success: boolean): RelayServiceContract {
  return {
    executeRelay: vi.fn().mockResolvedValue({
      success,
      transactionId: success ? 'tx123' : undefined,
      error: success ? undefined : { message: 'relay failed', code: 'RELAY_ERROR' },
    }),
  } as unknown as RelayServiceContract;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScheduledTransferService.processDueTransfers — lease acquisition', () => {
  it('skips a transfer when the lease cannot be acquired', async () => {
    const transfer = makeTransfer();
    const store = makeAsyncStore([transfer]);
    (store.tryAcquireProcessing as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const relayService = makeRelayService(true);
    const svc = new ScheduledTransferService(store, relayService);

    const processed = await svc.processDueTransfers(new Date());
    expect(processed).toBe(0);
    expect(relayService.executeRelay).not.toHaveBeenCalled();
  });

  it('releases the lease even if execution throws', async () => {
    const transfer = makeTransfer();
    const store = makeAsyncStore([transfer]);
    const relayService = {
      executeRelay: vi.fn().mockRejectedValue(new Error('network timeout')),
    } as unknown as RelayServiceContract;

    const svc = new ScheduledTransferService(store, relayService);

    await expect(svc.processDueTransfers(new Date())).resolves.toBeDefined();
    expect(store.releaseProcessing).toHaveBeenCalledWith(transfer.id);
  });
});

describe('ScheduledTransferService — failure notifications', () => {
  it('calls onConsecutiveFailure when consecutive failures > 1', async () => {
    const transfer = makeTransfer({ consecutiveFailures: 1 }); // 1 existing, will become 2
    const store = makeAsyncStore([transfer]);
    const relayService = makeRelayService(false);

    const notifier: FailureNotifier = {
      onConsecutiveFailure: vi.fn().mockResolvedValue(undefined),
      onMaxFailuresReached: vi.fn().mockResolvedValue(undefined),
    };

    const svc = new ScheduledTransferService(store, relayService, notifier);
    await svc.processDueTransfers(new Date());

    expect(notifier.onConsecutiveFailure).toHaveBeenCalledOnce();
    expect(notifier.onConsecutiveFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'xfer-1' }),
      2,
    );
  });

  it('calls onMaxFailuresReached when consecutive failures reach the cap', async () => {
    const transfer = makeTransfer({ consecutiveFailures: 4, frequency: 'monthly' }); // will become 5
    const store = makeAsyncStore([transfer]);
    const relayService = makeRelayService(false);

    const notifier: FailureNotifier = {
      onConsecutiveFailure: vi.fn().mockResolvedValue(undefined),
      onMaxFailuresReached: vi.fn().mockResolvedValue(undefined),
    };

    const svc = new ScheduledTransferService(store, relayService, notifier);
    await svc.processDueTransfers(new Date());

    expect(notifier.onMaxFailuresReached).toHaveBeenCalledOnce();
    expect(notifier.onConsecutiveFailure).not.toHaveBeenCalled();
  });

  it('records failure notification in pg store on max failures', async () => {
    const transfer = makeTransfer({ consecutiveFailures: 4, frequency: 'daily' });
    const store = makeAsyncStore([transfer]);
    const relayService = makeRelayService(false);

    const svc = new ScheduledTransferService(store, relayService);
    await svc.processDueTransfers(new Date());

    expect(store.recordFailureNotification).toHaveBeenCalledWith(
      transfer.id,
      'max_failures_reached',
      expect.objectContaining({ consecutiveFailures: 5 }),
    );
  });

  it('does NOT call onConsecutiveFailure on the first failure', async () => {
    const transfer = makeTransfer({ consecutiveFailures: 0 }); // will become 1
    const store = makeAsyncStore([transfer]);
    const relayService = makeRelayService(false);

    const notifier: FailureNotifier = {
      onConsecutiveFailure: vi.fn().mockResolvedValue(undefined),
      onMaxFailuresReached: vi.fn().mockResolvedValue(undefined),
    };

    const svc = new ScheduledTransferService(store, relayService, notifier);
    await svc.processDueTransfers(new Date());

    expect(notifier.onConsecutiveFailure).not.toHaveBeenCalled();
  });
});

describe('ScheduledTransferService — once-frequency transfers', () => {
  it('marks a once-frequency transfer completed on success', async () => {
    const transfer = makeTransfer({ frequency: 'once' });
    const store = makeAsyncStore([transfer]);
    const relayService = makeRelayService(true);

    const svc = new ScheduledTransferService(store, relayService);
    await svc.processDueTransfers(new Date());

    expect(store.updateAfterExecution).toHaveBeenCalledWith(
      'xfer-1',
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('marks a once-frequency transfer completed even on failure', async () => {
    const transfer = makeTransfer({ frequency: 'once' });
    const store = makeAsyncStore([transfer]);
    const relayService = makeRelayService(false);

    const svc = new ScheduledTransferService(store, relayService);
    await svc.processDueTransfers(new Date());

    expect(store.updateAfterExecution).toHaveBeenCalledWith(
      'xfer-1',
      expect.objectContaining({ status: 'completed' }),
    );
  });
});
