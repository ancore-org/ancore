import { SchedulerEngine } from '../SchedulerEngine';
import type { ScheduledTransferService } from '../ScheduledTransferService';
import {
  schedulerJobsExecuted,
  schedulerJobsSucceeded,
  schedulerJobsFailed,
  schedulerConsecutiveFailures,
} from '../../metrics/index';

/** Counter snapshot, so assertions are deltas rather than absolute process-wide totals. */
function snapshot() {
  return {
    executed: schedulerJobsExecuted.get(),
    succeeded: schedulerJobsSucceeded.get(),
    failed: schedulerJobsFailed.get(),
    consecutive: schedulerConsecutiveFailures.get(),
  };
}

function delta(before: ReturnType<typeof snapshot>) {
  const after = snapshot();
  return {
    executed: after.executed - before.executed,
    succeeded: after.succeeded - before.succeeded,
    failed: after.failed - before.failed,
    consecutive: after.consecutive - before.consecutive,
  };
}

function engineWith(processDueTransfers: jest.Mock) {
  const service = { processDueTransfers } as unknown as ScheduledTransferService;
  return new SchedulerEngine(service, { pollIntervalMs: 1 });
}

describe('SchedulerEngine metrics', () => {
  it('records a success metric when transfers are processed', async () => {
    const before = snapshot();
    const engine = engineWith(jest.fn().mockResolvedValue(3));

    await expect(engine.tick()).resolves.toBe(3);

    expect(delta(before)).toEqual({ executed: 1, succeeded: 1, failed: 0, consecutive: 0 });
  });

  it('records a success metric for an idle tick that processed nothing', async () => {
    // Regression: previously guarded behind `if (processed > 0)`, so an idle
    // scheduler was indistinguishable from one that had stopped running.
    const before = snapshot();
    const engine = engineWith(jest.fn().mockResolvedValue(0));

    await expect(engine.tick()).resolves.toBe(0);

    expect(delta(before)).toEqual({ executed: 1, succeeded: 1, failed: 0, consecutive: 0 });
  });

  it('records a failure metric and rethrows when the tick throws', async () => {
    const before = snapshot();
    const engine = engineWith(jest.fn().mockRejectedValue(new Error('db unreachable')));

    await expect(engine.tick()).rejects.toThrow('db unreachable');

    const d = delta(before);
    expect(d.executed).toBe(1);
    expect(d.succeeded).toBe(0);
    expect(d.failed).toBe(1);
  });

  it('increments the consecutive-failure counter only from the second failure on', async () => {
    const engine = engineWith(jest.fn().mockRejectedValue(new Error('boom')));

    const beforeFirst = snapshot();
    await expect(engine.tick()).rejects.toThrow('boom');
    expect(delta(beforeFirst).consecutive).toBe(0);

    const beforeSecond = snapshot();
    await expect(engine.tick()).rejects.toThrow('boom');
    expect(delta(beforeSecond).consecutive).toBe(1);
  });

  it('resets the consecutive-failure streak after a success', async () => {
    const processDueTransfers = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('boom'));
    const engine = engineWith(processDueTransfers);

    await expect(engine.tick()).rejects.toThrow('boom');
    await expect(engine.tick()).rejects.toThrow('boom');
    await expect(engine.tick()).resolves.toBe(0);

    // Streak was reset by the success, so this failure is a "first" again.
    const beforeFourth = snapshot();
    await expect(engine.tick()).rejects.toThrow('boom');
    expect(delta(beforeFourth).consecutive).toBe(0);
  });
});

describe('SchedulerEngine polling loop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps polling after a failed tick without an unhandled rejection', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    const processDueTransfers = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue(0);
    const engine = engineWith(processDueTransfers);

    try {
      engine.start();

      // Drive several poll intervals; the first tick rejects.
      for (let i = 0; i < 3; i += 1) {
        await jest.advanceTimersByTimeAsync(1);
      }

      engine.stop();

      expect(processDueTransfers.mock.calls.length).toBeGreaterThan(1);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('stops scheduling further ticks once stopped', async () => {
    const processDueTransfers = jest.fn().mockResolvedValue(0);
    const engine = engineWith(processDueTransfers);

    engine.start();
    await jest.advanceTimersByTimeAsync(1);
    engine.stop();

    const callsAtStop = processDueTransfers.mock.calls.length;
    await jest.advanceTimersByTimeAsync(50);

    expect(processDueTransfers.mock.calls.length).toBe(callsAtStop);
  });
});
