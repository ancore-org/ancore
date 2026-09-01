import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BULK_PAYOUT_CHECKPOINT_KEY,
  BULK_PAYOUT_CONCURRENCY,
  clearBulkPayoutCheckpoint,
  executeBulkPayoutBatch,
  loadBulkPayoutCheckpoint,
  type BulkPayoutRow,
  type CheckpointStorage,
  type PayoutSubmission,
} from '../bulk-payouts';

/**
 * Concurrency and checkpointing for payout batches (#1349).
 *
 * The batch ran one row at a time and kept nothing, so a few hundred payouts
 * took a few hundred sequential round trips and a tab closed halfway through
 * lost every record of what had already been submitted — while those payouts
 * stayed completed on-chain.
 */

function makeRows(count: number): BulkPayoutRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `row-${index + 1}`,
    lineNumber: index + 2,
    recipient: `G${'A'.repeat(55)}`,
    amount: '1.0000000',
    status: 'pending' as const,
    errors: [],
  }));
}

/** An in-memory `CheckpointStorage`, so tests never touch a real localStorage. */
function makeStorage(): CheckpointStorage & { dump(): Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
    dump: () => ({ ...store }),
  };
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('executeBulkPayoutBatch concurrency (#1349)', () => {
  it('submits every row and reports them in the caller’s order', async () => {
    const rows = makeRows(6);
    const seen: string[] = [];
    const submit = vi.fn(async (submission: PayoutSubmission) => {
      seen.push(submission.recipient);
    });

    const summary = await executeBulkPayoutBatch(rows, submit);

    expect(submit).toHaveBeenCalledTimes(6);
    expect(summary.total).toBe(6);
    expect(summary.successful).toBe(6);
    expect(summary.failed).toBe(0);
    // Completion order varies with concurrency; the summary must not.
    expect(summary.results.map((result) => result.row.id)).toEqual(rows.map((row) => row.id));
  });

  it('runs rows in parallel up to the concurrency limit', async () => {
    const rows = makeRows(8);
    let inFlight = 0;
    let peak = 0;

    const submit = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    await executeBulkPayoutBatch(rows, submit, { concurrency: 3 });

    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('never exceeds the default concurrency', async () => {
    const rows = makeRows(20);
    let inFlight = 0;
    let peak = 0;

    await executeBulkPayoutBatch(rows, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    expect(peak).toBeLessThanOrEqual(BULK_PAYOUT_CONCURRENCY);
  });

  /** Each row is caught on its own — one failure must not sink its neighbours. */
  it('keeps going when a row fails', async () => {
    const rows = makeRows(5);
    const submit = vi.fn(async (submission: PayoutSubmission) => {
      if (submission.idempotencyKey.endsWith('row-3')) {
        throw new Error('relay rejected');
      }
    });

    const summary = await executeBulkPayoutBatch(rows, submit, { concurrency: 2 });

    expect(submit).toHaveBeenCalledTimes(5);
    expect(summary.successful).toBe(4);
    expect(summary.failed).toBe(1);

    const failed = summary.results.find((result) => result.row.id === 'row-3');
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('relay rejected');
  });

  it('handles an empty batch', async () => {
    const summary = await executeBulkPayoutBatch([], vi.fn());

    expect(summary).toEqual({ total: 0, successful: 0, failed: 0, results: [] });
  });

  it('reports progress as rows settle', async () => {
    const rows = makeRows(4);
    const progress: Array<{ completed: number; total: number }> = [];

    await executeBulkPayoutBatch(rows, async () => {}, {
      concurrency: 2,
      onProgress: (update) => progress.push(update),
    });

    expect(progress).toHaveLength(4);
    expect(progress[progress.length - 1]).toEqual({ completed: 4, total: 4 });
  });

  it('carries a per-row idempotency key', async () => {
    const rows = makeRows(3);
    const keys: string[] = [];

    await executeBulkPayoutBatch(rows, async (submission) => {
      keys.push(submission.idempotencyKey);
    });

    expect(new Set(keys).size).toBe(3);
    expect(keys).toContain('bulk-payout-row-1');
  });
});

describe('executeBulkPayoutBatch checkpointing (#1349)', () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('persists each row as it settles, not only at the end', async () => {
    const rows = makeRows(3);
    const gate = deferred<void>();
    let submitted = 0;

    const run = executeBulkPayoutBatch(
      rows,
      async () => {
        submitted += 1;
        if (submitted === 1) return;
        await gate.promise;
      },
      { batchId: 'batch-1', storage, concurrency: 1 }
    );

    // Let the first row settle while the rest are still blocked.
    await vi.waitFor(() => {
      expect(storage.getItem(BULK_PAYOUT_CHECKPOINT_KEY)).toBeTruthy();
    });

    const midFlight = JSON.parse(storage.getItem(BULK_PAYOUT_CHECKPOINT_KEY)!);
    expect(Object.keys(midFlight.entries)).toContain('row-1');

    gate.resolve();
    await run;
  });

  /**
   * The scenario the issue describes: the tab closes mid-batch. A resumed run
   * must not pay the already-submitted rows a second time.
   */
  it('does not resubmit rows that already settled in an earlier run', async () => {
    const rows = makeRows(4);

    const firstAttempt = vi.fn(async (submission: PayoutSubmission) => {
      if (submission.idempotencyKey.endsWith('row-3')) {
        throw new Error('interrupted');
      }
    });
    await executeBulkPayoutBatch(rows, firstAttempt, { batchId: 'batch-1', storage });
    expect(firstAttempt).toHaveBeenCalledTimes(4);

    const secondAttempt = vi.fn(async () => {});
    const summary = await executeBulkPayoutBatch(rows, secondAttempt, {
      batchId: 'batch-1',
      storage,
    });

    // Everything already settled, so nothing is sent again.
    expect(secondAttempt).not.toHaveBeenCalled();
    expect(summary.total).toBe(4);
    expect(summary.successful).toBe(3);
    expect(summary.failed).toBe(1);
  });

  it('submits only the rows that never settled', async () => {
    const rows = makeRows(4);

    // A first run that only reaches two rows, simulated by checkpointing them.
    storage.setItem(
      BULK_PAYOUT_CHECKPOINT_KEY,
      JSON.stringify({
        version: 1,
        batchId: 'batch-1',
        updatedAt: Date.now(),
        entries: { 'row-1': { status: 'success' }, 'row-2': { status: 'success' } },
      })
    );

    const submit = vi.fn(async () => {});
    const summary = await executeBulkPayoutBatch(rows, submit, {
      batchId: 'batch-1',
      storage,
    });

    expect(submit).toHaveBeenCalledTimes(2);
    const resubmitted = submit.mock.calls.map(([submission]) => submission.idempotencyKey);
    expect(resubmitted).toEqual(['bulk-payout-row-3', 'bulk-payout-row-4']);
    expect(summary.successful).toBe(4);
  });

  /** A checkpoint from another batch says nothing about this one. */
  it('ignores a checkpoint written by a different batch', async () => {
    const rows = makeRows(2);
    storage.setItem(
      BULK_PAYOUT_CHECKPOINT_KEY,
      JSON.stringify({
        version: 1,
        batchId: 'some-other-batch',
        updatedAt: Date.now(),
        entries: { 'row-1': { status: 'success' } },
      })
    );

    const submit = vi.fn(async () => {});
    await executeBulkPayoutBatch(rows, submit, { batchId: 'batch-1', storage });

    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('ignores a checkpoint written by an older version', async () => {
    const rows = makeRows(2);
    storage.setItem(
      BULK_PAYOUT_CHECKPOINT_KEY,
      JSON.stringify({
        version: 0,
        batchId: 'batch-1',
        updatedAt: Date.now(),
        entries: { 'row-1': { status: 'success' } },
      })
    );

    const submit = vi.fn(async () => {});
    await executeBulkPayoutBatch(rows, submit, { batchId: 'batch-1', storage });

    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('ignores a corrupt checkpoint rather than refusing to run', async () => {
    const rows = makeRows(2);
    storage.setItem(BULK_PAYOUT_CHECKPOINT_KEY, '{not json');

    const submit = vi.fn(async () => {});
    await expect(
      executeBulkPayoutBatch(rows, submit, { batchId: 'batch-1', storage })
    ).resolves.toMatchObject({ successful: 2 });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('writes nothing when no batchId is given', async () => {
    const rows = makeRows(2);

    await executeBulkPayoutBatch(rows, async () => {}, { storage });

    expect(storage.dump()).toEqual({});
  });

  /**
   * A payout batch must not stop because the browser refused to remember
   * something. Losing resume is worse than losing nothing, but not worse than
   * abandoning a half-finished batch.
   */
  it('completes the batch even when storage throws', async () => {
    const rows = makeRows(3);
    const hostile: CheckpointStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };

    const submit = vi.fn(async () => {});
    const summary = await executeBulkPayoutBatch(rows, submit, {
      batchId: 'batch-1',
      storage: hostile,
    });

    expect(submit).toHaveBeenCalledTimes(3);
    expect(summary.successful).toBe(3);
  });
});

describe('loadBulkPayoutCheckpoint (#1349)', () => {
  it('reports what an interrupted run already submitted', async () => {
    const storage = makeStorage();
    const rows = makeRows(4);

    await executeBulkPayoutBatch(
      rows.slice(0, 2),
      async (submission) => {
        if (submission.idempotencyKey.endsWith('row-2')) throw new Error('relay rejected');
      },
      { batchId: 'batch-1', storage }
    );

    const resumed = loadBulkPayoutCheckpoint('batch-1', rows, storage);

    expect(resumed).not.toBeNull();
    expect(resumed!.total).toBe(4);
    expect(resumed!.successful).toBe(1);
    expect(resumed!.failed).toBe(1);
    expect(resumed!.results.map((result) => result.row.id)).toEqual(['row-1', 'row-2']);
    expect(resumed!.results[1].error).toBe('relay rejected');
  });

  it('returns null when nothing was recorded', () => {
    expect(loadBulkPayoutCheckpoint('batch-1', makeRows(2), makeStorage())).toBeNull();
  });

  it('returns null for a different batch', async () => {
    const storage = makeStorage();
    const rows = makeRows(2);
    await executeBulkPayoutBatch(rows, async () => {}, { batchId: 'batch-1', storage });

    expect(loadBulkPayoutCheckpoint('batch-2', rows, storage)).toBeNull();
  });

  it('is cleared once the summary has been recorded', async () => {
    const storage = makeStorage();
    const rows = makeRows(2);
    await executeBulkPayoutBatch(rows, async () => {}, { batchId: 'batch-1', storage });

    clearBulkPayoutCheckpoint(storage);

    expect(loadBulkPayoutCheckpoint('batch-1', rows, storage)).toBeNull();
  });
});
