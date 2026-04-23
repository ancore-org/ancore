import { render, screen, fireEvent } from '@testing-library/react';
import { SessionKeysScreen } from '../SessionKeysScreen';
import { useSessionKeys } from '../../../hooks/useSessionKeys';
import { SessionPermission } from '../../../hooks/useSessionKeys';
import { vi } from 'vitest';

vi.mock('../../../hooks/useSessionKeys');

const mockUseSessionKeys = useSessionKeys as ReturnType<typeof vi.fn>;

const baseKey = {
  publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt: Date.now() + 86_400_000,
  label: 'Personal Key',
};

const baseHook = {
  sessionKeys: [baseKey],
  isLoading: false,
  error: null,
  addSessionKey: vi.fn(),
  revokeSessionKey: vi.fn(),
  refreshSessionKey: vi.fn(),
  clearError: vi.fn(),
};

describe('SessionKeysScreen', () => {
  beforeEach(() => {
    mockUseSessionKeys.mockReturnValue({ ...baseHook });
  });

  it('renders the session keys screen', () => {
    render(<SessionKeysScreen />);
    expect(screen.getByText('Session Keys')).toBeInTheDocument();
    expect(screen.getByText('What are session keys?')).toBeInTheDocument();
    expect(screen.getByText(/Personal Key/)).toBeInTheDocument();
  });

  it('shows Active badge for a non-expired key', () => {
    render(<SessionKeysScreen />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Expired badge for a past key', () => {
    mockUseSessionKeys.mockReturnValue({
      ...baseHook,
      sessionKeys: [{ ...baseKey, expiresAt: Date.now() - 1000 }],
    });
    render(<SessionKeysScreen />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows permission labels', () => {
    render(<SessionKeysScreen />);
    expect(screen.getByText(/Send Payment/)).toBeInTheDocument();
  });

  it('shows loading indicator when isLoading is true', () => {
    mockUseSessionKeys.mockReturnValue({ ...baseHook, sessionKeys: [], isLoading: true });
    render(<SessionKeysScreen />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it('shows empty state when no keys and not loading', () => {
    mockUseSessionKeys.mockReturnValue({ ...baseHook, sessionKeys: [], isLoading: false });
    render(<SessionKeysScreen />);
    expect(screen.getByText(/No session keys yet/)).toBeInTheDocument();
  });

  it('shows error banner when error is set', () => {
    mockUseSessionKeys.mockReturnValue({ ...baseHook, error: 'Failed to revoke' });
    render(<SessionKeysScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to revoke');
  });

  it('calls clearError when dismiss button is clicked', () => {
    const clearError = vi.fn();
    mockUseSessionKeys.mockReturnValue({ ...baseHook, error: 'Oops', clearError });
    render(<SessionKeysScreen />);
    fireEvent.click(screen.getByLabelText('Dismiss error'));
    expect(clearError).toHaveBeenCalledTimes(1);
  });

  it('calls revokeSessionKey with the key publicKey', () => {
    const revokeSessionKey = vi.fn();
    mockUseSessionKeys.mockReturnValue({ ...baseHook, revokeSessionKey });
    render(<SessionKeysScreen />);
    fireEvent.click(screen.getByText('Revoke'));
    expect(revokeSessionKey).toHaveBeenCalledWith(baseKey.publicKey);
  });

  it('opens the add session key dialog when + is clicked', () => {
    render(<SessionKeysScreen />);
    fireEvent.click(screen.getByLabelText('Add session key'));
    expect(screen.getByText('Add Session Key')).toBeInTheDocument();
  });
});
