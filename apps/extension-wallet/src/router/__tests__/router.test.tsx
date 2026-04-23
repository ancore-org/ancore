import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, DEFAULT_AUTH_STATE } from '../AuthGuard';
import { ExtensionRouterTestHarness } from '..';

const mockUnlock = vi.fn<(password: string) => Promise<boolean>>();
const mockLock = vi.fn();

vi.mock('@ancore/core-sdk', async () => {
  const actual = await vi.importActual<object>('@ancore/core-sdk');
  class MockSecureStorageManager {
    unlock(password: string) {
      return mockUnlock(password);
    }

    lock() {
      mockLock();
    }
  }

  return {
    ...actual,
    SecureStorageManager: MockSecureStorageManager,
    createStorageAdapter: () => ({}),
  };
});

function renderRouter(pathname: string, authState = DEFAULT_AUTH_STATE) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
  return render(<ExtensionRouterTestHarness initialEntries={[pathname]} />);
}

describe('extension router', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.title = 'Ancore Extension';
    mockUnlock.mockReset();
    mockLock.mockReset();
    mockUnlock.mockResolvedValue(true);
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

  it('keeps users locked and shows an error when unlock credentials are invalid', async () => {
    const user = userEvent.setup();
    mockUnlock.mockResolvedValue(false);
    renderRouter('/unlock', {
      ...DEFAULT_AUTH_STATE,
      hasOnboarded: true,
      isUnlocked: false,
    });

    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid password/i);
    expect(screen.getByRole('heading', { name: /unlock wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /home/i })).not.toBeInTheDocument();
  });
});
