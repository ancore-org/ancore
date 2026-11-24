import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DashboardAuthProvider,
  DASHBOARD_SESSION_STORAGE_KEY,
  readDashboardSession,
  useDashboardAuth,
  type DashboardSession,
} from '../session';

function AuthProbe() {
  const { session, status, isBootstrapped, login, logout, refreshSession } = useDashboardAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="bootstrapped">{String(isBootstrapped)}</span>
      <span data-testid="display-name">{session?.displayName ?? 'none'}</span>
      <button data-testid="login" onClick={login} type="button">
        login
      </button>
      <button data-testid="logout" onClick={logout} type="button">
        logout
      </button>
      <button data-testid="refresh" onClick={refreshSession} type="button">
        refresh
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <DashboardAuthProvider>
      <AuthProbe />
    </DashboardAuthProvider>
  );
}

function makeSession(expiresAt: number): DashboardSession {
  return {
    userId: 'user-1',
    displayName: 'Ada',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresAt: expiresAt,
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('readDashboardSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when the storage key is missing', () => {
    expect(readDashboardSession()).toBeNull();
  });

  it('returns null when the stored value is invalid JSON', () => {
    localStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, '{not-json');

    expect(readDashboardSession()).toBeNull();
  });

  it('returns null when a field has the wrong shape', () => {
    localStorage.setItem(
      DASHBOARD_SESSION_STORAGE_KEY,
      JSON.stringify({ ...makeSession(Date.now() + 60_000), accessTokenExpiresAt: 'later' })
    );

    expect(readDashboardSession()).toBeNull();
  });

  it('returns a valid stored session', () => {
    const session = makeSession(Date.now() + 60_000);
    localStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, JSON.stringify(session));

    expect(readDashboardSession()).toEqual(session);
  });
});

describe('DashboardAuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('authenticates with an unexpired stored session', async () => {
    localStorage.setItem(
      DASHBOARD_SESSION_STORAGE_KEY,
      JSON.stringify(makeSession(Date.now() + 60_000))
    );

    renderProvider();
    await flushEffects();

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('bootstrapped')).toHaveTextContent('true');
    expect(screen.getByTestId('display-name')).toHaveTextContent('Ada');
  });

  it('ends unauthenticated when nothing is stored', async () => {
    renderProvider();
    await flushEffects();

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('display-name')).toHaveTextContent('none');
  });

  it('signs out and removes storage for an expired session', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    localStorage.setItem(
      DASHBOARD_SESSION_STORAGE_KEY,
      JSON.stringify(makeSession(Date.now() - 1_000))
    );

    renderProvider();
    await flushEffects();

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(localStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY)).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('session refresh is a stub'));
  });

  it('clears storage and state on logout', async () => {
    localStorage.setItem(
      DASHBOARD_SESSION_STORAGE_KEY,
      JSON.stringify(makeSession(Date.now() + 60_000))
    );

    renderProvider();
    await flushEffects();
    fireEvent.click(screen.getByTestId('logout'));

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('display-name')).toHaveTextContent('none');
    expect(localStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('leaves the user unauthenticated on login, matching current behaviour', async () => {
    localStorage.setItem(
      DASHBOARD_SESSION_STORAGE_KEY,
      JSON.stringify(makeSession(Date.now() + 60_000))
    );

    renderProvider();
    await flushEffects();
    fireEvent.click(screen.getByTestId('login'));

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(localStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('runs the refresh stub and signs out when refreshSession is called', async () => {
    localStorage.setItem(
      DASHBOARD_SESSION_STORAGE_KEY,
      JSON.stringify(makeSession(Date.now() + 60_000))
    );

    renderProvider();
    await flushEffects();
    fireEvent.click(screen.getByTestId('refresh'));
    await flushEffects();

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(localStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY)).toBeNull();
  });
});
