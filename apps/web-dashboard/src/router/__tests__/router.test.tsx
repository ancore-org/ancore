import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DASHBOARD_SESSION_STORAGE_KEY } from '../../auth';
import { DashboardAppTestHarness } from '..';

function writeSession(session: {
  userId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}) {
  window.localStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, JSON.stringify(session));
}

describe('dashboard router', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('sends unauthenticated users to the login fallback', async () => {
    render(<DashboardAppTestHarness initialEntries={['/dashboard']} />);

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('boots a stored session into the protected dashboard shell', async () => {
    writeSession({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: Date.now() + 60_000,
    });

    render(<DashboardAppTestHarness initialEntries={['/dashboard']} />);

    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByText(/ops admin/i, { selector: 'span' })).toBeInTheDocument();
  });

  it('refreshes an expired session before rendering protected routes', async () => {
    writeSession({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: Date.now() - 60_000,
    });

    render(<DashboardAppTestHarness initialEntries={['/dashboard']} />);

    expect(screen.getByRole('heading', { name: /refreshing session/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('falls back to login when a refreshable session cannot be restored', async () => {
    writeSession({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: '',
      accessTokenExpiresAt: Date.now() - 60_000,
    });

    render(<DashboardAppTestHarness initialEntries={['/dashboard']} />);

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('supports login navigation from the fallback screen', async () => {
    const user = userEvent.setup();
    render(<DashboardAppTestHarness initialEntries={['/login']} />);

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), 'Dashboard Ops');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument()
    );
    expect(screen.getByText(/dashboard ops/i, { selector: 'span' })).toBeInTheDocument();
  });

  it('redirects authenticated users away from the login route', async () => {
    writeSession({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: Date.now() + 60_000,
    });

    render(<DashboardAppTestHarness initialEntries={['/login']} />);

    expect(await screen.findByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('renders the transaction table route for authenticated users', async () => {
    writeSession({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: Date.now() + 60_000,
    });

    render(<DashboardAppTestHarness initialEntries={['/dashboard/transactions']} />);

    expect(await screen.findByRole('heading', { name: /transactions/i })).toBeInTheDocument();
  });

  it('renders the bulk payouts route for authenticated users', async () => {
    writeSession({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: Date.now() + 60_000,
    });

    render(<DashboardAppTestHarness initialEntries={['/dashboard/bulk-payouts']} />);

    expect(await screen.findByRole('heading', { name: /bulk payouts/i })).toBeInTheDocument();
  });
});
