import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AutoLockView } from '../SecuritySettings';
import { formatRemainingLockTime } from '@/background/session-state';
import { UNLOCK_SESSION_STORAGE_KEY } from '@ancore/wallet-shared';

describe('formatRemainingLockTime', () => {
  it('formats remaining lock time properly', () => {
    expect(formatRemainingLockTime(60_000)).toBe('Locks in 1 minute');
    expect(formatRemainingLockTime(300_000)).toBe('Locks in 5 minutes');
    expect(formatRemainingLockTime(900_000)).toBe('Locks in 15 minutes');
    expect(formatRemainingLockTime(0)).toBe('Locks in 0 minutes');
    expect(formatRemainingLockTime(-10_000)).toBe('Locks in 0 minutes');
  });

  it('rounds up partial minutes to nearest minute', () => {
    expect(formatRemainingLockTime(65_000)).toBe('Locks in 2 minutes');
    expect(formatRemainingLockTime(125_000)).toBe('Locks in 3 minutes');
  });
});

describe('AutoLockView countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders countdown timer formatted as Locks in X minutes', () => {
    render(<AutoLockView value={15} onChange={() => {}} onDone={() => {}} />);

    const countdown = screen.getByTestId('auto-lock-countdown');
    expect(countdown).toBeDefined();
    expect(countdown.textContent).toBe('Locks in 15 minutes');
  });

  it('displays remaining time from chrome.storage.session if present', async () => {
    const expiresAt = Date.now() + 4 * 60_000;
    (globalThis as any).chrome = {
      storage: {
        session: {
          get: vi.fn((_key, cb) => cb({ [UNLOCK_SESSION_STORAGE_KEY]: { expiresAt } })),
        },
      },
    };

    render(<AutoLockView value={15} onChange={() => {}} onDone={() => {}} />);

    await act(async () => {
      // allow promise to resolve
      await Promise.resolve();
    });

    const countdown = screen.getByTestId('auto-lock-countdown');
    expect(countdown.textContent).toBe('Locks in 4 minutes');

    delete (globalThis as any).chrome;
  });
});
