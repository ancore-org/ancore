/**
 * Inactivity Detector
 *
 * Tracks user activity events and fires a callback after a configurable
 * period of inactivity. Cleans up all listeners on destroy().
 *
 * Accepts an optional Clock for deterministic testing.
 */

import { type Clock, systemClock } from '@/utils/clock';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

/**
 * Convert a configured auto-lock timeout in minutes into the millisecond
 * value expected by {@link InactivityDetector}.
 *
 * `0` (and any non-positive value) is preserved as `0`, matching the
 * detector's "never lock" sentinel.
 */
export function minutesToInactivityMs(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.floor(minutes * 60 * 1000);
}

export class InactivityDetector {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onInactive: () => void;
  private timeoutMs: number;
  private active = false;
  private readonly clock: Clock;

  constructor(onInactive: () => void, timeoutMs: number, clock: Clock = systemClock) {
    this.onInactive = onInactive;
    this.timeoutMs = timeoutMs;
    this.clock = clock;
    this.handleActivity = this.handleActivity.bind(this);
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, this.handleActivity, true));
    this.resetTimer();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    ACTIVITY_EVENTS.forEach((event) =>
      window.removeEventListener(event, this.handleActivity, true)
    );
    this.clearTimer();
  }

  /** Update the timeout without restarting listeners. */
  setTimeoutMs(ms: number): void {
    this.timeoutMs = ms;
    if (this.active) this.resetTimer();
  }

  /** Call this to manually signal activity (e.g. from background messages). */
  touch(): void {
    if (this.active) this.resetTimer();
  }

  private handleActivity(): void {
    this.resetTimer();
  }

  private resetTimer(): void {
    this.clearTimer();
    if (this.timeoutMs <= 0) return; // 0 = never lock
    this.timer = this.clock.setTimeout(() => {
      this.onInactive();
    }, this.timeoutMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.stop();
  }
}
