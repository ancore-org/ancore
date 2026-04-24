import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionKeysScreen } from '../SessionKeysScreen';
import { useSessionKeys, SessionPermission } from '../../../hooks/useSessionKeys';

vi.mock('../../../hooks/useSessionKeys');

const mockUseSessionKeys = useSessionKeys as unknown as ReturnType<typeof vi.fn>;

const activeKey = {
  publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
  permissions: [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT],
  expiresAt: Date.now() + 86_400_000,
  label: 'Trading Bot',
};

describe('SessionKeysScreen Integration', () => {
  let addSessionKey: ReturnType<typeof vi.fn>;
  let revokeSessionKey: ReturnType<typeof vi.fn>;
  let refreshSessionKey: ReturnType<typeof vi.fn>;
  let clearError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addSessionKey = vi.fn().mockResolvedValue(undefined);
    revokeSessionKey = vi.fn().mockResolvedValue(undefined);
    refreshSessionKey = vi.fn().mockResolvedValue(undefined);
    clearError = vi.fn();

    mockUseSessionKeys.mockReturnValue({
      sessionKeys: [activeKey],
      isLoading: false,
      error: null,
      addSessionKey,
      revokeSessionKey,
      refreshSessionKey,
      clearError,
    });
  });

  describe('revoke flow', () => {
    it('calls revokeSessionKey with the correct publicKey', async () => {
      render(<SessionKeysScreen />);
      fireEvent.click(screen.getByText('Revoke'));
      await waitFor(() => {
        expect(revokeSessionKey).toHaveBeenCalledWith(activeKey.publicKey);
      });
    });

    it('shows error banner when revokeSessionKey rejects', async () => {
      revokeSessionKey.mockRejectedValue(new Error('Network error'));
      mockUseSessionKeys.mockReturnValue({
        sessionKeys: [activeKey],
        isLoading: false,
        error: 'Network error',
        addSessionKey,
        revokeSessionKey,
        refreshSessionKey,
        clearError,
      });
      render(<SessionKeysScreen />);
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  describe('add flow', () => {
    it('opens dialog on + click', () => {
      render(<SessionKeysScreen />);
      fireEvent.click(screen.getByLabelText('Add session key'));
      expect(screen.getByText('Add Session Key')).toBeInTheDocument();
    });

    it('calls addSessionKey with label, permissions, and expiresAt', async () => {
      render(<SessionKeysScreen />);
      fireEvent.click(screen.getByLabelText('Add session key'));

      fireEvent.change(screen.getByPlaceholderText('e.g. Trading Bot'), {
        target: { value: 'My Bot' },
      });
      fireEvent.click(screen.getByLabelText('Send Payment'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(addSessionKey).toHaveBeenCalledTimes(1);
        const arg = addSessionKey.mock.calls[0][0];
        expect(arg.label).toBe('My Bot');
        expect(arg.permissions).toContain(SessionPermission.SEND_PAYMENT);
        expect(typeof arg.expiresAt).toBe('number');
        expect(arg.expiresAt).toBeGreaterThan(Date.now());
      });
    });

    it('shows error banner when addSessionKey rejects', async () => {
      addSessionKey.mockRejectedValue(new Error('Contract call failed'));
      render(<SessionKeysScreen />);
      fireEvent.click(screen.getByLabelText('Add session key'));

      fireEvent.change(screen.getByPlaceholderText('e.g. Trading Bot'), {
        target: { value: 'My Bot' },
      });
      fireEvent.click(screen.getByLabelText('Send Payment'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(addSessionKey).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('expiry and permission display', () => {
    it('shows permission labels for all assigned permissions', () => {
      render(<SessionKeysScreen />);
      expect(screen.getByText(/Send Payment/)).toBeInTheDocument();
      expect(screen.getByText(/Invoke Contract/)).toBeInTheDocument();
    });

    it('shows Expired badge for expired key', () => {
      mockUseSessionKeys.mockReturnValue({
        sessionKeys: [{ ...activeKey, expiresAt: Date.now() - 1 }],
        isLoading: false,
        error: null,
        addSessionKey,
        revokeSessionKey,
        refreshSessionKey,
        clearError,
      });
      render(<SessionKeysScreen />);
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });

    it('shows truncated public key', () => {
      render(<SessionKeysScreen />);
      expect(screen.getByText(/GABC1234…/)).toBeInTheDocument();
    });
  });
});
