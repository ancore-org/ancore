import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionKeys, SessionKeysPanel } from '../SessionKeysPanel';
import { formatRelativeExpiry } from '../../utils/time';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));

// Mock lucide-react to avoid issues with SVG rendering in tests
vi.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="alert-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
  Key: () => <div data-testid="key-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
}));

// Mock @ancore/ui-kit
vi.mock('@ancore/ui-kit', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  Skeleton: ({ className, ...props }: any) => (
    <div className={className} aria-hidden="true" {...props} />
  ),
  Badge: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} {...props}>
      {children}
    </span>
  ),
  useToast: () => ({ toast: mockToast }),
}));

describe('SessionKeys Widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const nowMs = 1700000000000;
  const validKey = {
    publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    expiresAt: Math.floor(nowMs / 1000) + 3600, // active
    label: 'Test Session Key',
  };
  const expiredKey = {
    publicKey: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    expiresAt: Math.floor(nowMs / 1000) - 3600, // expired
  };

  it('renders loading state correctly', () => {
    render(<SessionKeys isLoading={true} />);
    expect(screen.getByTestId('session-keys-loading')).toBeInTheDocument();
  });

  it('renders empty state when no keys are present', () => {
    render(<SessionKeys keys={[]} />);
    expect(screen.getByTestId('session-keys-empty')).toBeInTheDocument();
    expect(screen.getByText('No session keys.')).toBeInTheDocument();
  });

  it('renders empty state when keys prop is undefined', () => {
    render(<SessionKeys keys={undefined} />);
    expect(screen.getByTestId('session-keys-empty')).toBeInTheDocument();
  });

  it('renders session keys list with active and expired statuses', () => {
    render(<SessionKeys keys={[validKey, expiredKey]} nowMs={nowMs} />);

    expect(screen.getByText('Test Session Key')).toBeInTheDocument();
    expect(screen.getByText('GBBBBBBB…BBBB')).toBeInTheDocument();

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('in 1 hour')).toBeInTheDocument();
    expect(screen.getByText('expired')).toBeInTheDocument();
    expect(screen.getByText('in 1 hour').closest('time')).toHaveAttribute(
      'title',
      new Date(validKey.expiresAt * 1000).toISOString()
    );
  });

  it('formats expiry values as relative countdowns', () => {
    expect(formatRelativeExpiry(Math.floor(nowMs / 1000) + 3 * 60 * 60, nowMs)).toBe('in 3 hours');
    expect(formatRelativeExpiry(Math.floor(nowMs / 1000) - 1, nowMs)).toBe('expired');
  });

  it('copies a key ID and shows a three-second success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<SessionKeysPanel keys={[validKey]} nowMs={nowMs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Test Session Key ID' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith('Key ID copied to clipboard', 'success', 3000)
    );
    expect(writeText).toHaveBeenCalledWith(validKey.publicKey);
  });

  it('revokes a key and shows success or error feedback', async () => {
    const onRevoke = vi.fn().mockResolvedValue(undefined);
    render(<SessionKeysPanel keys={[validKey]} nowMs={nowMs} onRevoke={onRevoke} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Test Session Key' }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith('Session key revoked', 'success', 3000)
    );
    expect(onRevoke).toHaveBeenCalledWith(validKey.publicKey);

    mockToast.mockClear();
    onRevoke.mockRejectedValueOnce(new Error('RPC unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Test Session Key' }));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith('Unable to revoke session key', 'error', 3000)
    );
  });

  it('catches API failure with WidgetErrorBoundary and renders retry button', () => {
    const onRetry = vi.fn();
    const apiError = new Error('Failed to fetch session keys from RPC');

    render(<SessionKeys error={apiError} onRetry={onRetry} />);

    // Assert WidgetErrorBoundary fallback UI
    expect(screen.getByText('Widget Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch session keys from RPC')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Click retry button
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('catches unhandled throw inside WidgetErrorBoundary and allows retry', () => {
    const onRetry = vi.fn();

    render(<SessionKeys error={new Error('Unexpected render crash')} onRetry={onRetry} />);

    expect(screen.getByText('Widget Failed')).toBeInTheDocument();
    expect(screen.getByText('Unexpected render crash')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('SessionKeysPanel renders inline error and retry button when shouldThrowOnError is false', () => {
    const onRetry = vi.fn();
    const apiError = new Error('Inline error message');

    render(<SessionKeysPanel error={apiError} onRetry={onRetry} shouldThrowOnError={false} />);

    expect(screen.getByTestId('session-keys-error')).toBeInTheDocument();
    expect(screen.getByText('Inline error message')).toBeInTheDocument();

    const retryBtn = screen.getByTestId('session-keys-retry-button');
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
