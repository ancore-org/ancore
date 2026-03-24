import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEY, DEFAULT_AUTH_STATE } from '../AuthGuard';
import { ExtensionRouterTestHarness } from '..';

function renderRouter(pathname: string, authState = DEFAULT_AUTH_STATE) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
  return render(<ExtensionRouterTestHarness initialEntries={[pathname]} />);
}

describe('extension router', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.title = 'Ancore Extension';
  });

  it('redirects first-time users to welcome when they hit a protected route', () => {
    renderRouter('/home');

    expect(screen.getByRole('heading', { name: /meet your ancore wallet/i })).toBeInTheDocument();
    expect(document.title).toBe('Welcome | Ancore Extension');
  });

  it('redirects onboarded locked users to unlock', () => {
    renderRouter('/send', {
      ...DEFAULT_AUTH_STATE,
      hasOnboarded: true,
      walletName: 'Locked Wallet',
    });

    expect(screen.getByRole('heading', { name: /unlock wallet/i })).toBeInTheDocument();
    expect(document.title).toBe('Unlock Wallet | Ancore Extension');
  });

  it('creates an account and lands on the protected home route', async () => {
    const user = userEvent.setup();
    renderRouter('/create-account');

    await user.clear(screen.getByLabelText(/wallet name/i));
    await user.type(screen.getByLabelText(/wallet name/i), 'Router Test Wallet');
    await user.click(screen.getByRole('button', { name: /create wallet/i }));

    expect(await screen.findByRole('heading', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByText(/router test wallet/i)).toBeInTheDocument();
    expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
  });

  it('navigates between protected routes and updates titles', async () => {
    const user = userEvent.setup();
    renderRouter('/home', {
      ...DEFAULT_AUTH_STATE,
      hasOnboarded: true,
      isUnlocked: true,
    });

    await user.click(screen.getByRole('link', { name: /settings/i }));

    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument();
    expect(document.title).toBe('Settings | Ancore Extension');
  });

  it('shows a 404 screen for unknown routes and recovers to the right fallback', async () => {
    const user = userEvent.setup();
    renderRouter('/not-a-real-route', {
      ...DEFAULT_AUTH_STATE,
      hasOnboarded: true,
      isUnlocked: true,
    });

    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(document.title).toBe('Page Not Found | Ancore Extension');

    await user.click(screen.getByRole('link', { name: /go back to safety/i }));

    expect(await screen.findByRole('heading', { name: /home/i })).toBeInTheDocument();
  });

  it('supports back-style navigation for nested routes', async () => {
    const user = userEvent.setup();
    renderRouter('/session-keys', {
      ...DEFAULT_AUTH_STATE,
      hasOnboarded: true,
      isUnlocked: true,
    });

    expect(screen.getByRole('heading', { name: /session keys/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));

    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });
});
