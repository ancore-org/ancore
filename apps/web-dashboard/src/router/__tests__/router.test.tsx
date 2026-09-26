import { render, screen } from '@testing-library/react';
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

  // Refresh has no backend endpoint to call yet (#1327) — it is an explicit,
  // delay-free stub that signs the user out rather than pretending to extend
  // the token, so an expired session ends at the login screen, not the
  // dashboard. The stub resolves within the same effect flush render() waits
  // out, so the transient "Refreshing session" frame isn't reliably
  // observable here — only the end state is.
  it('signs out an expired session instead of restoring the protected dashboard', async () => {
    writeSession({
      userId: 'user-1',
      displayName: 'Ops Admin',
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      accessTokenExpiresAt: Date.now() - 60_000,
    });

    render(<DashboardAppTestHarness initialEntries={['/dashboard']} />);

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
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

  it('does not authenticate arbitrary display names', async () => {
    render(<DashboardAppTestHarness initialEntries={['/login']} />);

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/server-backed identity provider/i);
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
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
