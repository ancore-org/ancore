import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InactivityDetector, minutesToInactivityMs } from '../inactivity-detector';

/**
 * Default idle timeout: 5 minutes (300 000 ms).
 * Matches the `autoLockTimeout: 5` default in dashboard-settings state.
 */
const DEFAULT_IDLE_MS = minutesToInactivityMs(5); // 300_000 ms

describe('InactivityDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onInactive after the configured idle timeout', () => {
    const lock = vi.fn();
    const detector = new InactivityDetector(lock, DEFAULT_IDLE_MS);
    detector.start();

    vi.advanceTimersByTime(DEFAULT_IDLE_MS + 1);

    expect(lock).toHaveBeenCalledOnce();
    detector.destroy();
  });

  it('does not fire before the timeout elapses', () => {
    const lock = vi.fn();
    const detector = new InactivityDetector(lock, DEFAULT_IDLE_MS);
    detector.start();

    vi.advanceTimersByTime(DEFAULT_IDLE_MS - 1);

    expect(lock).not.toHaveBeenCalled();
    detector.destroy();
  });

  it('resets the timer on touch(), delaying the lock', () => {
    const lock = vi.fn();
    const detector = new InactivityDetector(lock, DEFAULT_IDLE_MS);
    detector.start();

    // Advance to just before the timeout, then signal activity
    vi.advanceTimersByTime(DEFAULT_IDLE_MS - 1);
    detector.touch();

    // Original deadline would have passed — lock must not have fired yet
    vi.advanceTimersByTime(DEFAULT_IDLE_MS - 1);
    expect(lock).not.toHaveBeenCalled();

    // Full timeout after the touch() → now it fires
    vi.advanceTimersByTime(2);
    expect(lock).toHaveBeenCalledOnce();
    detector.destroy();
  });

  it('never fires when timeoutMs is 0 (disabled)', () => {
    const lock = vi.fn();
    const detector = new InactivityDetector(lock, 0);
    detector.start();

    vi.advanceTimersByTime(999_999);

    expect(lock).not.toHaveBeenCalled();
    detector.destroy();
  });

  it('does not fire after stop()', () => {
    const lock = vi.fn();
    const detector = new InactivityDetector(lock, DEFAULT_IDLE_MS);
    detector.start();

    vi.advanceTimersByTime(DEFAULT_IDLE_MS / 2);
    detector.stop();

    vi.advanceTimersByTime(DEFAULT_IDLE_MS);
    expect(lock).not.toHaveBeenCalled();
  });

  it('applies a new timeout via setTimeoutMs without restarting listeners', () => {
    const lock = vi.fn();
    const CUSTOM_MS = 10_000;
    const detector = new InactivityDetector(lock, DEFAULT_IDLE_MS);
    detector.start();

    detector.setTimeoutMs(CUSTOM_MS);
    vi.advanceTimersByTime(CUSTOM_MS + 1);

    expect(lock).toHaveBeenCalledOnce();
    detector.destroy();
  });

  it('fires lock on DOM activity events resetting the timer', () => {
    const lock = vi.fn();
    const IDLE_MS = 5_000;
    const detector = new InactivityDetector(lock, IDLE_MS);
    detector.start();

    // Simulate user activity just before the timeout
    vi.advanceTimersByTime(IDLE_MS - 1);
    window.dispatchEvent(new Event('click', { bubbles: true }));

    // Timer should have reset; another full interval must pass before lock
    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(lock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(lock).toHaveBeenCalledOnce();
    detector.destroy();
  });
});

describe('minutesToInactivityMs', () => {
  it('converts positive minutes to milliseconds', () => {
    expect(minutesToInactivityMs(1)).toBe(60_000);
    expect(minutesToInactivityMs(5)).toBe(300_000);
  });

  it('returns 0 for zero or negative values (disabled)', () => {
    expect(minutesToInactivityMs(0)).toBe(0);
    expect(minutesToInactivityMs(-1)).toBe(0);
  });

  it('returns 0 for non-finite values', () => {
    expect(minutesToInactivityMs(Infinity)).toBe(0);
    expect(minutesToInactivityMs(NaN)).toBe(0);
  });
});
