/**
 * Clock Abstraction
 *
 * Provides a deterministic, injectable clock interface so that any
 * time-dependent feature (inactivity detection, polling intervals,
 * timestamp generation) can be tested without real timers.
 *
 * Usage in production:  pass `systemClock` (or omit — it's the default).
 * Usage in tests:       pass a `ManualClock` instance and advance time
 *                       explicitly with `tick()` / `setNow()`.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface Clock {
  /** Returns the current time as a Unix timestamp in milliseconds. */
  now(): number;

  /**
   * Schedules `fn` to run after `ms` milliseconds.
   * Returns an opaque handle that can be passed to `clearTimeout`.
   */
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;

  /** Cancels a timeout created by this clock's `setTimeout`. */
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;

  /**
   * Schedules `fn` to run repeatedly every `ms` milliseconds.
   * Returns an opaque handle that can be passed to `clearInterval`.
   */
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval>;

  /** Cancels an interval created by this clock's `setInterval`. */
  clearInterval(handle: ReturnType<typeof setInterval>): void;
}

// ---------------------------------------------------------------------------
// System clock (production default)
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around the real browser/Node timer APIs.
 * This is the clock used in production code.
 */
export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h),
};

// ---------------------------------------------------------------------------
// Manual clock (test / deterministic use)
// ---------------------------------------------------------------------------

interface ScheduledCallback {
  id: number;
  triggerAt: number;
  fn: () => void;
  interval: number | null; // null = one-shot, >0 = repeating
}

/**
 * A fully deterministic clock for use in tests and simulations.
 *
 * Time only advances when you call `tick(ms)` or `setNow(ms)`.
 * All scheduled callbacks fire synchronously when their trigger time
 * is reached during an advance.
 *
 * @example
 * const clock = new ManualClock(1_000);
 * const fired: number[] = [];
 *
 * clock.setTimeout(() => fired.push(clock.now()), 500);
 * clock.tick(499); // fired = []
 * clock.tick(1);   // fired = [1500]
 */
export class ManualClock implements Clock {
  private _now: number;
  private _nextId = 1;
  private _pending: ScheduledCallback[] = [];

  constructor(startMs = 0) {
    this._now = startMs;
  }

  now(): number {
    return this._now;
  }

  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = this._nextId++;
    this._pending.push({ id, triggerAt: this._now + ms, fn, interval: null });
    return id as unknown as ReturnType<typeof setTimeout>;
  }

  clearTimeout(handle: ReturnType<typeof setTimeout>): void {
    const id = handle as unknown as number;
    this._pending = this._pending.filter((c) => c.id !== id);
  }

  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
    const id = this._nextId++;
    this._pending.push({ id, triggerAt: this._now + ms, fn, interval: ms });
    return id as unknown as ReturnType<typeof setInterval>;
  }

  clearInterval(handle: ReturnType<typeof setInterval>): void {
    const id = handle as unknown as number;
    this._pending = this._pending.filter((c) => c.id !== id);
  }

  /**
   * Advance the clock by `ms` milliseconds, firing all callbacks whose
   * trigger time falls within the new range (in chronological order).
   */
  tick(ms: number): void {
    this.setNow(this._now + ms);
  }

  /**
   * Jump the clock to an absolute timestamp, firing all pending callbacks
   * whose trigger time is ≤ the new time (in chronological order).
   */
  setNow(absoluteMs: number): void {
    if (absoluteMs < this._now) {
      throw new Error(
        `ManualClock: cannot go backwards (current=${this._now}, requested=${absoluteMs})`
      );
    }

    this._now = absoluteMs;
    this._flush();
  }

  /** Returns the number of pending (not-yet-fired) callbacks. */
  get pendingCount(): number {
    return this._pending.length;
  }

  /** Cancels all pending callbacks without firing them. */
  reset(newNow = 0): void {
    this._now = newNow;
    this._pending = [];
  }

  private _flush(): void {
    // Keep firing until no more callbacks are due — intervals reschedule
    // themselves, so we loop until the queue is stable.
    let safety = 10_000;

    while (safety-- > 0) {
      const due = this._pending
        .filter((c) => c.triggerAt <= this._now)
        .sort((a, b) => a.triggerAt - b.triggerAt);

      if (due.length === 0) break;

      for (const cb of due) {
        // Remove before firing so the callback can reschedule if needed
        this._pending = this._pending.filter((c) => c.id !== cb.id);

        cb.fn();

        // Reschedule repeating intervals
        if (cb.interval !== null) {
          this._pending.push({
            ...cb,
            triggerAt: cb.triggerAt + cb.interval,
          });
        }
      }
    }
  }
}
