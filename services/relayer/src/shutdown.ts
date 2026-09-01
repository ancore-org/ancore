/**
 * Graceful shutdown for the relayer (#1346).
 *
 * Every orchestrator — Kubernetes rolling deploys, ECS task replacement,
 * `docker compose down` — sends SIGTERM and then waits a grace period before
 * SIGKILL. With no handler installed, Node's default action for SIGTERM is to
 * terminate immediately: the process dies mid-request, mid-scheduler-tick, and
 * mid-relay-execution.
 *
 * For this service that last one is the problem. A relay execution that is
 * killed after the transaction is signed and submitted but before the
 * confirmation is recorded leaves the ledger and our store disagreeing, with
 * nothing on either side that says which way. Draining is not hygiene here;
 * it is the difference between a deploy being invisible and a deploy creating
 * reconciliation work.
 *
 * The sequence, in order, because the order is the whole design:
 *
 *   1. **Stop taking new work.** `server.close()` stops accepting connections
 *      while letting in-flight requests finish, and the scheduler stops
 *      queueing new ticks. Anything arriving now is the load balancer's
 *      problem, which is what it is for.
 *   2. **Finish what is in flight**, bounded by a deadline. HTTP responses,
 *      the current scheduler tick, and any queue jobs drain concurrently —
 *      they are independent, and running them in series would multiply the
 *      worst case by three.
 *   3. **Exit.** Zero if everything drained, non-zero if the deadline hit
 *      first, so an orchestrator's logs distinguish a clean drain from a
 *      truncated one.
 *
 * A second signal during shutdown exits immediately: an operator pressing
 * Ctrl-C twice means "stop now", and honouring that is better than appearing
 * hung.
 */

import type { Server } from 'node:http';

/** Anything with a bounded drain — `SchedulerEngine` and `QueueWorker` both fit. */
export interface Drainable {
  /** Stop new work and wait for in-flight work, up to `timeoutMs`. */
  drain(timeoutMs: number): Promise<boolean>;
}

export interface ShutdownOptions {
  /** The listening HTTP server, if the process has one. */
  server?: Pick<Server, 'close'>;
  /** Background components to drain alongside the HTTP server. */
  drainables?: Drainable[];
  /**
   * Total budget for the whole drain.
   *
   * Must be comfortably below the orchestrator's grace period (Kubernetes
   * defaults to 30s), or SIGKILL arrives mid-drain and the handler achieves
   * nothing.
   */
  timeoutMs?: number;
  log?: (message: string, detail?: unknown) => void;
  exit?: (code: number) => void;
}

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

/** Signals that mean "wind down", as opposed to "stop right now". */
export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;

export type ShutdownSignal = (typeof SHUTDOWN_SIGNALS)[number];

/**
 * Close the HTTP listener and wait for in-flight requests.
 *
 * Resolves `true` on a clean close, `false` on timeout. Never rejects: a
 * server that was already closed reports an error through the callback, and
 * that is not a reason to abandon the rest of the shutdown.
 */
function closeServer(server: Pick<Server, 'close'>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (clean: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(clean);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    // Do not hold the event loop open purely to time out.
    timer.unref?.();

    server.close(() => finish(true));
  });
}

/**
 * Bound any promise by the shutdown deadline.
 *
 * `Drainable.drain` takes a timeout and is expected to honour it, but the
 * shutdown budget cannot depend on every component getting that right — a
 * drain that ignores its timeout, or hangs before reaching its own timer,
 * would hold the process open until the orchestrator's SIGKILL and take the
 * rest of the shutdown down with it. The deadline is enforced here as well.
 */
function withDeadline(work: Promise<boolean>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref?.();
  });

  return Promise.race([work, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Run one shutdown pass. Exported for tests, which drive it directly rather
 * than by raising real signals at the test runner's own process.
 */
export async function runShutdown(options: ShutdownOptions = {}): Promise<boolean> {
  const {
    server,
    drainables = [],
    timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
    log = (message, detail) =>
      detail === undefined ? console.log(message) : console.log(message, detail),
  } = options;

  log('[shutdown] draining', { timeoutMs, drainables: drainables.length });

  // Concurrent, not sequential: these do not depend on each other, and the
  // deadline is a wall-clock budget for the shutdown as a whole.
  const results = await Promise.all([
    server ? closeServer(server, timeoutMs) : Promise.resolve(true),
    ...drainables.map((drainable) =>
      withDeadline(
        Promise.resolve()
          .then(() => drainable.drain(timeoutMs))
          .catch((error) => {
            // A drain that throws has still stopped accepting work, which is
            // the part that matters. Record it and treat the pass as unclean.
            log('[shutdown] drain failed', error);
            return false;
          }),
        timeoutMs
      )
    ),
  ]);

  const clean = results.every(Boolean);
  log(clean ? '[shutdown] drained cleanly' : '[shutdown] drain timed out; exiting anyway');
  return clean;
}

/**
 * Install SIGTERM/SIGINT handlers.
 *
 * Returns a function that removes them again, so tests and embedders can undo
 * it without leaking listeners across the process.
 */
export function installShutdownHandlers(options: ShutdownOptions = {}): () => void {
  const { log = (message: string) => console.log(message), exit = (code) => process.exit(code) } =
    options;

  let shuttingDown = false;

  const handle = (signal: ShutdownSignal): void => {
    if (shuttingDown) {
      // Second signal: the operator has asked twice. Stop pretending to drain.
      log(`[shutdown] received ${signal} again; exiting immediately`);
      exit(1);
      return;
    }

    shuttingDown = true;
    log(`[shutdown] received ${signal}`);

    void runShutdown(options).then(
      (clean) => exit(clean ? 0 : 1),
      (error) => {
        log('[shutdown] failed', error);
        exit(1);
      }
    );
  };

  const listeners = SHUTDOWN_SIGNALS.map((signal) => {
    const listener = (): void => handle(signal);
    process.on(signal, listener);
    return [signal, listener] as const;
  });

  return () => {
    for (const [signal, listener] of listeners) {
      process.off(signal, listener);
    }
  };
}
