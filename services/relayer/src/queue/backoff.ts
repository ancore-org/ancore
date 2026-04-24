/**
 * Exponential backoff with full jitter.
 *
 * delay = random(0, min(cap, base * 2^attempt))
 *
 * @param attempt  Zero-based attempt index (0 = first retry)
 * @param baseMs   Base delay in milliseconds (default 1 000 ms)
 * @param capMs    Maximum delay cap in milliseconds (default 60 000 ms)
 */
export function computeBackoffMs(
  attempt: number,
  baseMs = 1_000,
  capMs = 60_000,
): number {
  const exponential = Math.min(capMs, baseMs * Math.pow(2, attempt));
  // Full jitter: uniform random in [0, exponential]
  return Math.floor(Math.random() * exponential);
}

/**
 * Returns the ISO timestamp after which the job may next be retried.
 */
export function nextRetryAfter(attempt: number, now = new Date()): string {
  const delayMs = computeBackoffMs(attempt);
  return new Date(now.getTime() + delayMs).toISOString();
}
