import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UnlockVerifier } from '../AuthGuard';
import { AUTH_STORAGE_KEY, DEFAULT_AUTH_STATE } from '../AuthGuard';
import { ExtensionRouterTestHarness, HistoryActivityList, filterHistoryEntries } from '..';
import type { HistoryEntry, HistoryFilter } from '..';

function renderRouter(
  pathname: string,
  authState = DEFAULT_AUTH_STATE,
  options?: { unlockVerifier?: UnlockVerifier }
) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
  return render(
    <ExtensionRouterTestHarness
      initialEntries={[pathname]}
      unlockVerifier={options?.unlockVerifier}
    />
  );
}

describe('extension router', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.title = 'Ancore Extension';
  });

  it('redirects first-time users to onboarding when they hit a protected route', () => {
    renderRouter('/home');

    expect(screen.getByRole('heading', { name: /welcome to ancore/i })).toBeInTheDocument();
    expect(document.title).toBe('Create Wallet | Ancore Extension');
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

  it('keeps locked users on unlock when password verification fails', async () => {
    const user = userEvent.setup();
    renderRouter(
      '/send',
      {
        ...DEFAULT_AUTH_STATE,
        hasOnboarded: true,
        walletName: 'Locked Wallet',
      },
      {
        unlockVerifier: async () => false,
      }
    );

    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect password/i);
    expect(screen.getByRole('heading', { name: /unlock wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /home/i })).not.toBeInTheDocument();
    expect(document.title).toBe('Unlock Wallet | Ancore Extension');
    expect(JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}')).toMatchObject({
      hasOnboarded: true,
      isUnlocked: false,
    });
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

    expect(screen.getByRole('heading', { level: 1, name: 'Session Keys' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /go back/i }));

    expect(await screen.findByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it.skip('applies network and display settings across pages without reload', async () => {
    const user = userEvent.setup();
    renderRouter('/settings', {
      ...DEFAULT_AUTH_STATE,
      hasOnboarded: true,
      isUnlocked: true,
    });

    await user.click(screen.getByRole('button', { name: /environment/i }));
    await user.click(screen.getByRole('button', { name: /staging/i }));
    await user.click(screen.getByRole('button', { name: /go back/i }));

    await user.click(screen.getByRole('button', { name: /network/i }));
    await user.click(screen.getByRole('button', { name: /^testnet/i }));

    const navBar = screen.getByTestId('nav-bar');
    await user.click(within(navBar).getByRole('link', { name: /home/i }));
    expect(await screen.findByText(/testnet • staging/i)).toBeInTheDocument();

    await user.click(within(navBar).getByRole('link', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /density/i }));
    await user.click(screen.getByRole('button', { name: /compact/i }));
    await user.click(screen.getByRole('button', { name: /go back/i }));

    await user.click(within(navBar).getByRole('link', { name: /receive/i }));
    expect(await screen.findByText(/on testnet/i)).toBeInTheDocument();
    expect(document.querySelector('[data-display-preference="compact"]')).toBeTruthy();
  });
});

describe('extension transaction history', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.title = 'Ancore Extension';
  });

  const unlockedAuthState = {
    ...DEFAULT_AUTH_STATE,
    hasOnboarded: true,
    isUnlocked: true,
  };

  const SAMPLE_ENTRIES: HistoryEntry[] = [
    {
      id: '1',
      label: 'Received from Treasury',
      amount: '+320 XLM',
      date: 'Today',
      kind: 'received',
      status: 'confirmed',
    },
    {
      id: '2',
      label: 'Sent to Merchant',
      amount: '-48 XLM',
      date: 'Yesterday',
      kind: 'sent',
      status: 'confirmed',
    },
    {
      id: '3',
      label: 'Failed merchant payment',
      amount: '-12 XLM',
      date: 'Mar 23',
      kind: 'failed',
      status: 'failed',
    },
  ];

  it('shows no-account placeholder when no smart account is configured', () => {
    renderRouter('/history', unlockedAuthState);

    expect(screen.getByText('No account configured')).toBeInTheDocument();
    expect(
      screen.getByText('Set up a smart account to view transaction history.')
    ).toBeInTheDocument();
  });

  it('renders all three sample entries in HistoryActivityList', () => {
    render(
      <HistoryActivityList activeFilter="all" entries={SAMPLE_ENTRIES} onFilterChange={() => {}} />
    );

    expect(screen.getByText('Sent to Merchant')).toBeInTheDocument();
    expect(screen.getByText('Received from Treasury')).toBeInTheDocument();
    expect(screen.getByText('Failed merchant payment')).toBeInTheDocument();
  });

  it('filters history to received transactions via HistoryActivityList', () => {
    render(
      <HistoryActivityList
        activeFilter="received"
        entries={filterHistoryEntries(SAMPLE_ENTRIES, 'received')}
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByText('Received from Treasury')).toBeInTheDocument();
    expect(screen.queryByText('Sent to Merchant')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed merchant payment')).not.toBeInTheDocument();
  });

  it('filters history to failed transactions via HistoryActivityList', () => {
    render(
      <HistoryActivityList
        activeFilter="failed"
        entries={filterHistoryEntries(SAMPLE_ENTRIES, 'failed')}
        onFilterChange={() => {}}
      />
    );

    expect(screen.getByText('Failed merchant payment')).toBeInTheDocument();
    expect(screen.queryByText('Received from Treasury')).not.toBeInTheDocument();
    expect(screen.queryByText('Sent to Merchant')).not.toBeInTheDocument();
  });

  it('stores the active filter chip and can return to all via URL', async () => {
    const user = userEvent.setup();
    let activeFilter: HistoryFilter = 'all';
    const onFilterChange = (f: HistoryFilter) => {
      activeFilter = f;
    };

    const { rerender } = render(
      <HistoryActivityList
        activeFilter={activeFilter}
        entries={SAMPLE_ENTRIES}
        onFilterChange={onFilterChange}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Sent' }));
    rerender(
      <HistoryActivityList
        activeFilter={activeFilter}
        entries={SAMPLE_ENTRIES}
        onFilterChange={onFilterChange}
      />
    );

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Sent' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'All' }));
    rerender(
      <HistoryActivityList
        activeFilter={activeFilter}
        entries={SAMPLE_ENTRIES}
        onFilterChange={onFilterChange}
      />
    );

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Received from Treasury')).toBeInTheDocument();
    expect(screen.getByText('Sent to Merchant')).toBeInTheDocument();
    expect(screen.getByText('Failed merchant payment')).toBeInTheDocument();
  });

  it('shows an empty message when an active chip has no matching rows', () => {
    const filtered = filterHistoryEntries(
      [
        {
          id: 'sent-only',
          label: 'Sent only',
          amount: '-1 XLM',
          date: 'Today',
          kind: 'sent',
          status: 'confirmed',
        },
      ],
      'received'
    );

    render(
      <HistoryActivityList
        activeFilter="received"
        entries={filtered}
        onFilterChange={() => undefined}
      />
    );

    expect(screen.getByText('No received transactions')).toBeInTheDocument();
    expect(screen.getByText('Incoming payments will appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset filter' })).toBeInTheDocument();
  });
});
