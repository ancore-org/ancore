/**
 * Unit tests for PgScheduledTransferStore.
 *
 * Uses an in-process mock of the pg Pool so no real database is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgScheduledTransferStore } from '../../src/scheduler/PgScheduledTransferStore';
import type { CreateScheduledTransferInput } from '../../src/scheduler/types';

// ── Pool mock helpers ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makePgPool(rowsByQuery: Map<string, Row[]> = new Map()) {
  return {
    query: vi.fn().mockImplementation((sql: string, _params?: unknown[]) => {
      // Match on keyword substrings for simplicity
      for (const [key, rows] of rowsByQuery) {
        if (sql.includes(key)) {
          return Promise.resolve({ rows, rowCount: rows.length });
        }
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
  };
}

function makeTransferRow(overrides: Partial<Row> = {}): Row {
  const now = new Date();
  return {
    id: 'xfer-uuid-1',
    account_id: 'GTEST_ACCOUNT',
    caller_id: 'caller-1',
    to_address: 'GDEST_ADDRESS',
    amount: '100',
    asset: 'USDC',
    frequency: 'monthly',
    status: 'active',
    start_at: now,
    next_run_at: now,
    end_at: null,
    note: null,
    user_approved_at: now,
    relay_payload: {
      sessionKey: 'aa'.repeat(32),
      operation: 'relay_execute',
      parameters: {},
      signature: 'bb'.repeat(64),
      nonce: 0,
    },
    consecutive_failures: 0,
    created_at: now,
    updated_at: now,
    last_execution_at: null,
    ...overrides,
  };
}

function makeValidInput(): CreateScheduledTransferInput {
  return {
    accountAddress: 'GTEST_ACCOUNT',
    to: 'GDEST_ADDRESS',
    amount: '100',
    asset: 'USDC',
    frequency: 'monthly',
    startAt: new Date(Date.now() + 60_000).toISOString(),
    userApproved: true,
    relayPayload: {
      sessionKey: 'aa'.repeat(32),
      operation: 'relay_execute',
      parameters: {},
      signature: 'bb'.repeat(64),
      nonce: 0,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PgScheduledTransferStore.create', () => {
  it('issues an INSERT and returns the created transfer', async () => {
    const row = makeTransferRow();
    const pool = makePgPool(new Map([['INSERT INTO scheduled_transfers', [row]]]));
    const store = new PgScheduledTransferStore(pool as never);

    const result = await store.create(makeValidInput(), 'caller-1');

    expect(pool.query).toHaveBeenCalledOnce();
    expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO scheduled_transfers');
    expect(result.id).toBe('xfer-uuid-1');
    expect(result.status).toBe('active');
    expect(result.accountId).toBe('GTEST_ACCOUNT');
  });
});

describe('PgScheduledTransferStore.listByAccount', () => {
  it('returns transfers matching account and caller', async () => {
    const rows = [makeTransferRow(), makeTransferRow({ id: 'xfer-uuid-2' })];
    const pool = makePgPool(new Map([['SELECT * FROM scheduled_transfers', rows]]));
    const store = new PgScheduledTransferStore(pool as never);

    const result = await store.listByAccount('GTEST_ACCOUNT', 'caller-1');

    expect(result).toHaveLength(2);
    expect(pool.query.mock.calls[0][1]).toContain('GTEST_ACCOUNT');
  });

  it('returns empty array when no rows are found', async () => {
    const pool = makePgPool();
    const store = new PgScheduledTransferStore(pool as never);
    const result = await store.listByAccount('GNONE', 'caller-1');
    expect(result).toHaveLength(0);
  });
});

describe('PgScheduledTransferStore.getByIdForCaller', () => {
  it('returns the transfer when it exists', async () => {
    const row = makeTransferRow();
    const pool = makePgPool(new Map([['SELECT * FROM scheduled_transfers WHERE id', [row]]]));
    const store = new PgScheduledTransferStore(pool as never);

    const result = await store.getByIdForCaller('xfer-uuid-1', 'caller-1');
    expect(result?.id).toBe('xfer-uuid-1');
  });

  it('returns undefined when the row does not exist', async () => {
    const pool = makePgPool();
    const store = new PgScheduledTransferStore(pool as never);
    const result = await store.getByIdForCaller('missing', 'caller-1');
    expect(result).toBeUndefined();
  });
});

describe('PgScheduledTransferStore.updateStatus', () => {
  it('issues an UPDATE and returns the updated transfer', async () => {
    const row = makeTransferRow({ status: 'paused' });
    const pool = makePgPool(new Map([['UPDATE scheduled_transfers', [row]]]));
    const store = new PgScheduledTransferStore(pool as never);

    const result = await store.updateStatus('xfer-uuid-1', 'paused');
    expect(result?.status).toBe('paused');
  });
});

describe('PgScheduledTransferStore.listDue', () => {
  it('returns only due active transfers without an active lease', async () => {
    const row = makeTransferRow({ next_run_at: new Date(Date.now() - 1000) });
    const pool = makePgPool(new Map([['WHERE st.status', [row]]]));
    const store = new PgScheduledTransferStore(pool as never);

    const result = await store.listDue(new Date());
    expect(result).toHaveLength(1);
  });
});

describe('PgScheduledTransferStore.tryAcquireLease', () => {
  it("returns true when the upsert returns this worker's worker_id", async () => {
    const store = new PgScheduledTransferStore(null as never);
    const workerId = (store as unknown as { workerId: string }).workerId;

    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ worker_id: workerId }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ worker_id: workerId }], rowCount: 1 }),
    };
    const s = new PgScheduledTransferStore(pool as never);
    // Override workerId to match the mock
    (s as unknown as { workerId: string }).workerId = workerId;

    const acquired = await s.tryAcquireLease('xfer-uuid-1');
    expect(acquired).toBe(true);
  });

  it('returns false when the upsert returns no rows (lock held by another worker)', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    const store = new PgScheduledTransferStore(pool as never);
    const acquired = await store.tryAcquireLease('xfer-uuid-1');
    expect(acquired).toBe(false);
  });
});

describe('PgScheduledTransferStore.appendExecution', () => {
  it('inserts an execution log row and returns it', async () => {
    const now = new Date();
    const row = {
      id: 'exec-uuid-1',
      scheduled_transfer_id: 'xfer-uuid-1',
      executed_at: now,
      outcome: 'success',
      transaction_id: 'tx123',
      error: null,
    };
    const pool = makePgPool(new Map([['INSERT INTO scheduled_transfer_executions', [row]]]));
    const store = new PgScheduledTransferStore(pool as never);

    const result = await store.appendExecution({
      scheduledTransferId: 'xfer-uuid-1',
      executedAt: now.toISOString(),
      outcome: 'success',
      transactionId: 'tx123',
    });

    expect(result.outcome).toBe('success');
    expect(result.transactionId).toBe('tx123');
  });
});

describe('PgScheduledTransferStore.recordFailureNotification', () => {
  it('inserts a notification row', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const store = new PgScheduledTransferStore(pool as never);

    await store.recordFailureNotification('xfer-uuid-1', 'consecutive_failure', {
      consecutiveFailures: 2,
    });

    expect(pool.query).toHaveBeenCalledOnce();
    expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO scheduled_transfer_notifications');
  });
});
