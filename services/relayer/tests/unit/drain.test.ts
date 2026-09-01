/**
 * Drain behaviour of the two background components a shutdown must wait for
 * (#1346): `SchedulerEngine`, which executes scheduled transfers, and
 * `QueueWorker`, which runs queued jobs.
 *
 * The point of interest in both is the tick or job that is *already running*
 * when the signal arrives. Stopping the poll loop is easy; not abandoning
 * in-flight work part-way through is the part that matters for a service that
 * signs and submits transactions.
 */

import { SchedulerEngine } from '../../src/scheduler/SchedulerEngine';
import { QueueWorker } from '../../src/workers/QueueWorker';

/** Deferred promise, so a test can hold work open and release it on demand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SchedulerEngine.drain (#1346)', () => {
  it('resolves immediately when the scheduler never started', async () => {
    const service = { processDueTransfers: jest.fn() };
    const engine = new SchedulerEngine(service as never, { pollIntervalMs: 10 });

    await expect(engine.drain(1000)).resolves.toBe(true);
    expect(service.processDueTransfers).not.toHaveBeenCalled();
  });

  it('stops the poll loop so no further ticks start', async () => {
    const service = { processDueTransfers: jest.fn().mockResolvedValue(0) };
    const engine = new SchedulerEngine(service as never, { pollIntervalMs: 5 });

    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 40));
    const ticksBeforeDrain = service.processDueTransfers.mock.calls.length;
    expect(ticksBeforeDrain).toBeGreaterThan(0);

    await engine.drain(1000);
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(service.processDueTransfers).toHaveBeenCalledTimes(ticksBeforeDrain);
  });

  /**
   * The case the issue is about: a tick is mid-flight, executing a scheduled
   * transfer. `drain` must not resolve until that transfer is done.
   */
  it('waits for a tick that is already executing transfers', async () => {
    const inFlight = deferred<number>();
    const service = { processDueTransfers: jest.fn().mockReturnValue(inFlight.promise) };
    const engine = new SchedulerEngine(service as never, { pollIntervalMs: 5 });

    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(engine.isTicking).toBe(true);

    let drained = false;
    const draining = engine.drain(1000).then((clean) => {
      drained = true;
      return clean;
    });

    // Still running: the drain must not have resolved.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(drained).toBe(false);

    inFlight.resolve(1);
    await expect(draining).resolves.toBe(true);
    expect(engine.isTicking).toBe(false);
  });

  it('gives up on a tick that outlasts the deadline, and says so', async () => {
    const stuck = deferred<number>();
    const service = { processDueTransfers: jest.fn().mockReturnValue(stuck.promise) };
    const engine = new SchedulerEngine(service as never, { pollIntervalMs: 5 });

    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 30));

    await expect(engine.drain(30)).resolves.toBe(false);

    stuck.resolve(0);
  });

  /**
   * A failing tick still counts as finished. Reporting it as still in flight
   * would hang every subsequent shutdown after one transient database blip.
   */
  it('treats a failing tick as drained rather than as still running', async () => {
    const failing = deferred<number>();
    const service = { processDueTransfers: jest.fn().mockReturnValue(failing.promise) };
    const engine = new SchedulerEngine(service as never, { pollIntervalMs: 5 });

    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const draining = engine.drain(1000);
    failing.reject(new Error('database unreachable'));

    await expect(draining).resolves.toBe(true);
    expect(engine.isTicking).toBe(false);
  });

  it('is safe to drain twice', async () => {
    const service = { processDueTransfers: jest.fn().mockResolvedValue(0) };
    const engine = new SchedulerEngine(service as never, { pollIntervalMs: 5 });

    engine.start();
    await expect(engine.drain(500)).resolves.toBe(true);
    await expect(engine.drain(500)).resolves.toBe(true);
  });
});

describe('QueueWorker.stop timeout (#1346)', () => {
  /** Minimal queue that hands out one job and then nothing. */
  function makeQueue(handlerGate: Promise<void>) {
    let dispatched = false;
    const job = { id: 'job-1', type: 'relay_execute' as const };

    return {
      queue: {
        dequeue: jest.fn(async () => {
          if (dispatched) return null;
          dispatched = true;
          return { job, ack: jest.fn(async () => {}), nack: jest.fn(async () => {}) };
        }),
        getById: jest.fn(async () => null),
      },
      handlers: {
        relay_execute: jest.fn(() => handlerGate),
      },
    };
  }

  it('waits for an in-flight job before resolving', async () => {
    const gate = deferred<void>();
    const { queue, handlers } = makeQueue(gate.promise);
    const worker = new QueueWorker(queue as never, handlers as never, { pollIntervalMs: 5 });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(worker.inFlight).toBe(1);

    let stopped = false;
    const stopping = worker.stop(1000).then(() => {
      stopped = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(stopped).toBe(false);

    gate.resolve();
    await stopping;
    expect(worker.inFlight).toBe(0);
  });

  /**
   * Without a bound, one handler that never settles keeps the process alive
   * until SIGKILL — turning a clean drain of everything else into a hard kill.
   */
  it('gives up on a job that never finishes instead of hanging shutdown', async () => {
    const neverSettles = deferred<void>();
    const { queue, handlers } = makeQueue(neverSettles.promise);
    const worker = new QueueWorker(queue as never, handlers as never, { pollIntervalMs: 5 });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const started = Date.now();
    await worker.stop(50);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(1000);
    expect(worker.inFlight).toBe(1);

    neverSettles.resolve();
  });

  it('resolves immediately when idle', async () => {
    const { queue, handlers } = makeQueue(Promise.resolve());
    const worker = new QueueWorker(queue as never, handlers as never, { pollIntervalMs: 5 });

    await expect(worker.stop(1000)).resolves.toBeUndefined();
  });

  it('still waits indefinitely when no timeout is given, preserving the old contract', async () => {
    const gate = deferred<void>();
    const { queue, handlers } = makeQueue(gate.promise);
    const worker = new QueueWorker(queue as never, handlers as never, { pollIntervalMs: 5 });

    worker.start();
    await new Promise((resolve) => setTimeout(resolve, 30));

    let stopped = false;
    const stopping = worker.stop().then(() => {
      stopped = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(stopped).toBe(false);

    gate.resolve();
    await stopping;
    expect(stopped).toBe(true);
  });
});
