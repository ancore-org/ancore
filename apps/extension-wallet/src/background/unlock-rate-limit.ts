/** Session-scoped key for unlock attempt tracking. */
export const UNLOCK_ATTEMPT_STORAGE_KEY = 'ancore_unlock_attempts';

/** Failed attempts before lockout begins. */
export const UNLOCK_MAX_ATTEMPTS = 5;

/** Base backoff duration applied on the first lockout. */
export const UNLOCK_BASE_BACKOFF_MS = 1_000;

/** Maximum lockout duration between attempts. */
export const UNLOCK_MAX_BACKOFF_MS = 60_000;

export interface UnlockAttemptState {
  failedAttempts: number;
  lockedUntil: number | null;
}

export const DEFAULT_UNLOCK_ATTEMPT_STATE: UnlockAttemptState = {
  failedAttempts: 0,
  lockedUntil: null,
};

export interface UnlockRateLimitResult {
  locked: boolean;
  retryAfterMs: number;
  message?: string;
}

export function calculateUnlockBackoffMs(failedAttempts: number): number {
  if (failedAttempts < UNLOCK_MAX_ATTEMPTS) {
    return 0;
  }

  const exponent = failedAttempts - UNLOCK_MAX_ATTEMPTS;
  const backoff = UNLOCK_BASE_BACKOFF_MS * 2 ** exponent;
  return Math.min(backoff, UNLOCK_MAX_BACKOFF_MS);
}

export function formatRetryMessage(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1_000);
  return seconds <= 1
    ? 'Too many failed attempts. Try again in 1 second.'
    : `Too many failed attempts. Try again in ${seconds} seconds.`;
}

export function checkUnlockRateLimit(
  state: UnlockAttemptState,
  now = Date.now()
): UnlockRateLimitResult {
  if (state.lockedUntil !== null && now < state.lockedUntil) {
    const retryAfterMs = state.lockedUntil - now;
    return {
      locked: true,
      retryAfterMs,
      message: formatRetryMessage(retryAfterMs),
    };
  }

  return { locked: false, retryAfterMs: 0 };
}

export function recordUnlockFailure(
  state: UnlockAttemptState,
  now = Date.now()
): UnlockAttemptState {
  const failedAttempts = state.failedAttempts + 1;
  const backoffMs = calculateUnlockBackoffMs(failedAttempts);

  if (backoffMs === 0) {
    return {
      failedAttempts,
      lockedUntil: null,
    };
  }

  return {
    failedAttempts,
    lockedUntil: now + backoffMs,
  };
}

export function resetUnlockAttempts(): UnlockAttemptState {
  return { ...DEFAULT_UNLOCK_ATTEMPT_STATE };
}

interface SessionStorageLike {
  get(key: string): Promise<unknown>;
  set(items: Record<string, unknown>): Promise<void>;
}

function getSessionStorage(): SessionStorageLike | null {
  const chromeRef = (globalThis as { chrome?: any }).chrome;
  if (chromeRef?.storage?.session) {
    return {
      get: (key: string) =>
        new Promise((resolve) => {
          chromeRef.storage.session.get(key, (result: Record<string, unknown>) => {
            resolve(result[key] ?? null);
          });
        }),
      set: (items: Record<string, unknown>) =>
        new Promise((resolve) => {
          chromeRef.storage.session.set(items, resolve);
        }),
    };
  }

  return null;
}

export async function loadUnlockAttemptState(): Promise<UnlockAttemptState> {
  const storage = getSessionStorage();
  if (!storage) {
    return { ...DEFAULT_UNLOCK_ATTEMPT_STATE };
  }

  try {
    const raw = await storage.get(UNLOCK_ATTEMPT_STORAGE_KEY);
    if (typeof raw !== 'string') {
      return { ...DEFAULT_UNLOCK_ATTEMPT_STATE };
    }

    const parsed = JSON.parse(raw) as Partial<UnlockAttemptState>;
    if (
      typeof parsed.failedAttempts !== 'number' ||
      (parsed.lockedUntil !== null &&
        parsed.lockedUntil !== undefined &&
        typeof parsed.lockedUntil !== 'number')
    ) {
      return { ...DEFAULT_UNLOCK_ATTEMPT_STATE };
    }

    const state: UnlockAttemptState = {
      failedAttempts: parsed.failedAttempts,
      lockedUntil: parsed.lockedUntil ?? null,
    };

    const limit = checkUnlockRateLimit(state);
    if (!limit.locked && state.lockedUntil !== null) {
      return resetUnlockAttempts();
    }

    return state;
  } catch {
    return { ...DEFAULT_UNLOCK_ATTEMPT_STATE };
  }
}

export async function saveUnlockAttemptState(state: UnlockAttemptState): Promise<void> {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  await storage.set({
    [UNLOCK_ATTEMPT_STORAGE_KEY]: JSON.stringify(state),
  });
}

export async function clearUnlockAttemptState(): Promise<void> {
  await saveUnlockAttemptState(resetUnlockAttempts());
}
