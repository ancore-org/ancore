/**
 * Graceful shutdown tests (#1346).
 *
 * These drive `runShutdown` / `installShutdownHandlers` directly rather than
 * raising real signals: a test that sends SIGTERM to the Jest process kills
 * the run, and `process.exit` is stubbed for the same reason.
 */

import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  installShutdownHandlers,
  runShutdown,
  SHUTDOWN_SIGNALS,
  type Drainable,
} from '../../src/shutdown';

/**
 * A server stub whose `close` callback fires when the test decides.
 *
 * Order-independent on purpose: a test may call `finish()` before or after
 * `runShutdown` reaches `close()`, and getting that ordering wrong should not
 * silently turn into "the server never closed".
 */
function makeServer() {
  let callback: ((err?: Error) => void) | undefined;
  let finished = false;

  const close = jest.fn((cb?: (err?: Error) => void) => {
    callback = cb;
    if (finished) cb?.();
  });

  return {
    server: { close } as never,
    close,
    /** Simulate the last in-flight request finishing. */
    finish: () => {
      finished = true;
      callback?.();
    },
  };
}

/** A drainable that resolves after `ms`, or never if `ms` is `null`. */
function makeDrainable(ms: number | null) {
  const drain = jest.fn(
    () =>
      new Promise<boolean>((resolve) => {
        if (ms !== null) setTimeout(() => resolve(true), ms);
      })
  );
  return { drain } as Drainable & { drain: jest.Mock };
}

describe('runShutdown', () => {
  it('closes the server and drains every component', async () => {
    const { server, close, finish } = makeServer();
    const scheduler = makeDrainable(0);
    const worker = makeDrainable(0);

    const pending = runShutdown({
      server,
      drainables: [scheduler, worker],
      timeoutMs: 1000,
      log: () => {},
    });
    finish();

    await expect(pending).resolves.toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(scheduler.drain).toHaveBeenCalledWith(1000);
    expect(worker.drain).toHaveBeenCalledWith(1000);
  });

  it('works with no server and no drainables', async () => {
    await expect(runShutdown({ log: () => {} })).resolves.toBe(true);
  });

  /**
   * The deadline is a budget for the shutdown as a whole. Draining in series
   * would make the worst case the sum of every component's timeout, which for
   * three components blows past any orchestrator's grace period.
   */
  it('drains components concurrently, not one after another', async () => {
    const { server, finish } = makeServer();
    finish();

    const slowA = makeDrainable(80);
    const slowB = makeDrainable(80);
    const slowC = makeDrainable(80);

    const started = Date.now();
    await runShutdown({
      server,
      drainables: [slowA, slowB, slowC],
      timeoutMs: 1000,
      log: () => {},
    });
    const elapsed = Date.now() - started;

    // Serial would be ~240ms; concurrent is ~80ms. The bound is loose enough
    // for a slow CI box but far below the serial figure.
    expect(elapsed).toBeLessThan(200);
  });

  it('reports an unclean shutdown when a drain outlasts the deadline', async () => {
    const { server, finish } = makeServer();
    finish();
    const stuck = makeDrainable(null);

    await expect(
      runShutdown({ server, drainables: [stuck], timeoutMs: 30, log: () => {} })
    ).resolves.toBe(false);
  });

  it('reports an unclean shutdown when in-flight requests never finish', async () => {
    const { server } = makeServer();
    // `finish()` is never called: the server stays open.

    await expect(runShutdown({ server, timeoutMs: 30, log: () => {} })).resolves.toBe(false);
  });

  /**
   * A drain that throws has still stopped accepting work. Losing the rest of
   * the shutdown to its exception would be strictly worse.
   */
  it('continues past a drain that throws, and marks the pass unclean', async () => {
    const { server, close, finish } = makeServer();
    finish();

    const exploding: Drainable = { drain: jest.fn().mockRejectedValue(new Error('boom')) };
    const healthy = makeDrainable(0);

    await expect(
      runShutdown({
        server,
        drainables: [exploding, healthy],
        timeoutMs: 500,
        log: () => {},
      })
    ).resolves.toBe(false);

    expect(healthy.drain).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('has a default timeout well inside a typical orchestrator grace period', () => {
    // Kubernetes defaults to 30s before SIGKILL; a budget equal to (or longer
    // than) that would mean SIGKILL lands while the handler is still draining,
    // which is the outcome the handler exists to prevent.
    expect(DEFAULT_SHUTDOWN_TIMEOUT_MS).toBeLessThan(30_000);
    expect(DEFAULT_SHUTDOWN_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it('reports a clean shutdown when there is nothing to close', async () => {
    const { server, finish } = makeServer();
    finish();

    await expect(
      runShutdown({ server, closers: [], timeoutMs: 1000, log: () => {} })
    ).resolves.toBe(true);
  });

  /**
   * The ordering is the point (#1470): `Pool#end()` refuses new queries, so a
   * connection pool closed in parallel with a draining request fails exactly
   * the work shutdown exists to finish.
   */
  it('releases resources only after the drains have settled', async () => {
    const { server, finish } = makeServer();
    const order: string[] = [];

    let releaseDrain: (() => void) | undefined;
    const drainable: Drainable = {
      drain: jest.fn(async () => {
        order.push('drain:start');
        await new Promise<void>((resolve) => {
          releaseDrain = resolve;
        });
        order.push('drain:end');
        return true;
      }),
    };

    const pending = runShutdown({
      server,
      drainables: [drainable],
      closers: [() => void order.push('close')],
      timeoutMs: 1000,
      log: () => {},
    });

    // The drain is still running here, so the closer must not have run yet.
    await new Promise((resolve) => setTimeout(resolve, 20));
    finish();
    expect(order).toEqual(['drain:start']);

    releaseDrain?.();
    await expect(pending).resolves.toBe(true);
    expect(order).toEqual(['drain:start', 'drain:end', 'close']);
  });

  /**
   * A drain that reports failure has still stopped accepting work, so the
   * resources behind it are safe to release — and releasing them is better
   * than exiting with connections open just because a drain went badly.
   */
  it('releases resources even when a drain reports failure, and reports it', async () => {
    const { server, finish } = makeServer();
    finish();
    const failedDrain: Drainable = { drain: jest.fn().mockResolvedValue(false) };
    const closer = jest.fn();

    await expect(
      runShutdown({
        server,
        drainables: [failedDrain],
        closers: [closer],
        timeoutMs: 500,
        log: () => {},
      })
    ).resolves.toBe(false);

    expect(closer).toHaveBeenCalledTimes(1);
  });

  /**
   * Once the budget is gone there is nothing left to spend on the release
   * phase: SIGKILL is next, and pretending to drain past the deadline is how a
   * process gets killed holding the connections anyway.
   */
  it('does not attempt to release resources once the drain has spent the budget', async () => {
    const { server } = makeServer();
    const closer = jest.fn();

    await expect(
      runShutdown({
        server,
        drainables: [makeDrainable(null)],
        closers: [closer],
        timeoutMs: 40,
        log: () => {},
      })
    ).resolves.toBe(false);

    expect(closer).not.toHaveBeenCalled();
  });

  it('reports an unclean shutdown when a closer throws', async () => {
    const { server, finish } = makeServer();
    finish();
    const healthy = jest.fn();

    await expect(
      runShutdown({
        server,
        closers: [
          () => {
            throw new Error('pool already closed');
          },
          healthy,
        ],
        timeoutMs: 500,
        log: () => {},
      })
    ).resolves.toBe(false);

    // A failed closer must not take the rest of the release phase with it.
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it('bounds the release phase by the budget left after draining', async () => {
    const { server, finish } = makeServer();
    finish();

    const started = Date.now();
    await expect(
      runShutdown({
        server,
        // Burns most of the budget before the closer phase is reached.
        drainables: [makeDrainable(60)],
        closers: [() => new Promise<void>(() => {})],
        timeoutMs: 100,
        log: () => {},
      })
    ).resolves.toBe(false);
    const elapsed = Date.now() - started;

    // Dropping the closer deadline entirely (or restarting the full budget for
    // it) would hold the process for the whole 100ms twice over.
    expect(elapsed).toBeLessThan(200);
  });
});

describe('installShutdownHandlers', () => {
  let uninstall: (() => void) | undefined;

  afterEach(() => {
    uninstall?.();
    uninstall = undefined;
  });

  it.each(SHUTDOWN_SIGNALS)('drains and exits zero on a clean %s', async (signal) => {
    const { server, finish } = makeServer();
    const scheduler = makeDrainable(0);
    const exit = jest.fn();

    uninstall = installShutdownHandlers({
      server,
      drainables: [scheduler],
      timeoutMs: 500,
      log: () => {},
      exit,
    });

    process.emit(signal);
    finish();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(scheduler.drain).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits non-zero when the drain does not complete in time', async () => {
    const { server } = makeServer();
    const exit = jest.fn();

    uninstall = installShutdownHandlers({
      server,
      drainables: [makeDrainable(null)],
      timeoutMs: 20,
      log: () => {},
      exit,
    });

    process.emit('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(exit).toHaveBeenCalledWith(1);
  });

  /**
   * An operator pressing Ctrl-C twice means "stop now". Appearing hung while
   * politely draining is the wrong answer to that.
   */
  it('exits immediately on a second signal', async () => {
    const { server } = makeServer();
    const exit = jest.fn();

    uninstall = installShutdownHandlers({
      server,
      drainables: [makeDrainable(null)],
      timeoutMs: 5000,
      log: () => {},
      exit,
    });

    process.emit('SIGINT');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(exit).not.toHaveBeenCalled();

    process.emit('SIGINT');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('only starts one drain no matter how many signals arrive', async () => {
    const { server, finish } = makeServer();
    const scheduler = makeDrainable(0);
    const exit = jest.fn();

    uninstall = installShutdownHandlers({
      server,
      drainables: [scheduler],
      timeoutMs: 500,
      log: () => {},
      exit,
    });

    process.emit('SIGTERM');
    process.emit('SIGTERM');
    process.emit('SIGINT');
    finish();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(scheduler.drain).toHaveBeenCalledTimes(1);
  });

  it('removes its listeners when uninstalled, leaving the process as it found it', () => {
    const before = SHUTDOWN_SIGNALS.map((signal) => process.listenerCount(signal));

    const remove = installShutdownHandlers({ log: () => {}, exit: () => {} });
    SHUTDOWN_SIGNALS.forEach((signal, index) => {
      expect(process.listenerCount(signal)).toBe(before[index] + 1);
    });

    remove();
    SHUTDOWN_SIGNALS.forEach((signal, index) => {
      expect(process.listenerCount(signal)).toBe(before[index]);
    });
  });
});
