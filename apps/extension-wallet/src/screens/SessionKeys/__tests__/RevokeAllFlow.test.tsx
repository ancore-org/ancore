import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationProvider } from '@ancore/ui-kit';
import { SessionKeysScreen } from '../SessionKeysScreen';
import { useSessionKeys, SessionPermission } from '../../../hooks/useSessionKeys';

vi.mock('../../../hooks/useSessionKeys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/useSessionKeys')>()),
  useSessionKeys: vi.fn(),
}));

const mockUseSessionKeys = useSessionKeys as unknown as ReturnType<typeof vi.fn>;

const keys = ['GAAA', 'GBBB'].map((prefix, i) => ({
  publicKey: `${prefix}${'1'.repeat(52)}`,
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt: Date.now() + 86_400_000,
  label: `Key ${i + 1}`,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('SessionKeysScreen revoke all flow', () => {
  let revokeSessionKey: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    revokeSessionKey = vi.fn().mockResolvedValue(undefined);
    mockUseSessionKeys.mockReturnValue({
      sessionKeys: keys,
      isLoading: false,
      error: null,
      addSessionKey: vi.fn(),
      revokeSessionKey,
      refreshSessionKey: vi.fn(),
      clearError: vi.fn(),
    });
    render(
      <NotificationProvider>
        <MemoryRouter>
          <SessionKeysScreen />
        </MemoryRouter>
      </NotificationProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Revoke all' }));
  });

  it('asks for confirmation with the affected key count and revokes nothing yet', () => {
    expect(screen.getByText(/2 session keys/)).toBeInTheDocument();
    expect(revokeSessionKey).not.toHaveBeenCalled();
  });

  it('leaves keys intact when the confirmation is cancelled', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(revokeSessionKey).not.toHaveBeenCalled();
  });

  it('revokes every key once confirmed', async () => {
    const buttons = screen.getAllByRole('button', { name: 'Revoke all' });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(revokeSessionKey).toHaveBeenCalledTimes(2));
    keys.forEach((key) => expect(revokeSessionKey).toHaveBeenCalledWith(key.publicKey));
  });
});
