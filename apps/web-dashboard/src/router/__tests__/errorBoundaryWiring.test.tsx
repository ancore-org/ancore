import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DASHBOARD_SESSION_STORAGE_KEY } from '../../auth';

/**
 * #1348, at the wiring level.
 *
 * `AppErrorBoundary.test.tsx` proves the boundary components work.
 * These prove they are actually *installed* — a boundary that exists but is
 * not mounted around the routed pages is exactly the state this issue
 * describes, and no unit test of the component would notice.
 *
 * `SendPage` is mocked to throw, standing in for any page-level render error
 * (bad data shape, third-party component throw). The assertion is that the
 * dashboard survives it.
 */

vi.mock('../../pages/Send', () => ({
  SendPage: () => {
    throw new Error('page render exploded');
  },
}));

function writeSession() {
  window.localStorage.setItem(
    DASHBOARD_SESSION_STORAGE_KEY,
    JSON.stringify({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: Date.now() + 60_000,
    })
  );
}

describe('dashboard error boundary wiring (#1348)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a recovery UI instead of a blank page when a route throws', async () => {
    writeSession();
    const { DashboardAppTestHarness } = await import('..');

    render(<DashboardAppTestHarness initialEntries={['/dashboard/send']} />);

    expect(await screen.findByText('This page could not be displayed')).toBeInTheDocument();
    // The document is not blank — the failure mode this issue is about.
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('keeps the dashboard navigation usable so the user can leave the broken page', async () => {
    writeSession();
    const { DashboardAppTestHarness } = await import('..');

    render(<DashboardAppTestHarness initialEntries={['/dashboard/send']} />);
    await screen.findByText('This page could not be displayed');

    // The shell rendered around the failed outlet, not instead of it.
    expect(screen.getByRole('navigation', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
  });

  it('recovers when the user navigates to a working page', async () => {
    const user = userEvent.setup();
    writeSession();
    const { DashboardAppTestHarness } = await import('..');

    render(<DashboardAppTestHarness initialEntries={['/dashboard/send']} />);
    await screen.findByText('This page could not be displayed');

    // The boundary is keyed on the pathname, so navigating clears it without
    // the user having to press "Try again" first.
    await user.click(screen.getByRole('link', { name: /overview/i }));

    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
    expect(screen.queryByText('This page could not be displayed')).not.toBeInTheDocument();
  });

  it('renders healthy routes untouched', async () => {
    writeSession();
    const { DashboardAppTestHarness } = await import('..');

    render(<DashboardAppTestHarness initialEntries={['/dashboard']} />);

    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
