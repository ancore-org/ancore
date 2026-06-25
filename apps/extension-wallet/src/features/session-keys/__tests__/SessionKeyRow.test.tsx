import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationProvider } from '@ancore/ui-kit';
import { SessionPermission } from '@ancore/types';
import type { SessionKey } from '@ancore/types';

import { SessionKeyRow } from '../SessionKeyRow';

const showSuccess = vi.fn();
const showError = vi.fn();

vi.mock('@ancore/ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ancore/ui-kit')>();
  return {
    ...actual,
    useToast: () => ({ showSuccess, showError, toast: vi.fn() }),
  };
});

const baseKey: SessionKey = {
  publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt: Date.now() + 2 * 86_400_000,
  label: 'Trading bot',
};

function renderRow(
  props: Partial<ComponentProps<typeof SessionKeyRow>> = {},
  keyOverrides: Partial<SessionKey> = {}
) {
  const onRevoke = vi.fn().mockResolvedValue(undefined);
  const onRefresh = vi.fn().mockResolvedValue(undefined);

  render(
    <NotificationProvider>
      <ul>
        <SessionKeyRow
          sessionKey={{ ...baseKey, ...keyOverrides }}
          onRevoke={onRevoke}
          onRefresh={onRefresh}
          {...props}
        />
      </ul>
    </NotificationProvider>
  );

  return { onRevoke, onRefresh };
}

describe('SessionKeyRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders countdown label and permissions', () => {
    renderRow();
    expect(screen.getByText(/Trading bot/)).toBeInTheDocument();
    expect(screen.getByText(/Send Payment/)).toBeInTheDocument();
    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent(/remaining/);
  });

  it('shows success toast after refresh', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByTestId('expiry-refresh-button'));

    await waitFor(() => {
      expect(showSuccess).toHaveBeenCalledWith('Session key expiry refreshed');
    });
  });

  it('shows error toast when refresh fails', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <NotificationProvider>
        <ul>
          <SessionKeyRow sessionKey={baseKey} onRevoke={vi.fn()} onRefresh={onRefresh} />
        </ul>
      </NotificationProvider>
    );

    await user.click(screen.getByTestId('expiry-refresh-button'));

    await waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Network error');
    });
  });

  it('disables refresh for revoked keys', () => {
    renderRow({}, { expiresAt: 0 });
    expect(screen.queryByTestId('expiry-refresh-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-key-row')).toHaveAttribute('data-status', 'revoked');
    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent('Revoked');
  });

  it('styles expired keys distinctly', () => {
    renderRow({}, { expiresAt: Date.now() - 60_000 });
    expect(screen.getByTestId('session-key-row')).toHaveAttribute('data-status', 'expired');
    expect(screen.getByTestId('expiry-countdown-label')).toHaveTextContent('Expired');
  });
});
