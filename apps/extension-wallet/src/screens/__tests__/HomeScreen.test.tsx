import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomeScreen from '../HomeScreen';
import { useAccountBalance } from '@/hooks/useAccountBalance';

// Mock the hook
vi.mock('@/hooks/useAccountBalance', () => ({
  useAccountBalance: vi.fn(),
  formatBalance: (b: number) => `${b.toFixed(2)} XLM`,
}));

// Mock ui-kit components
vi.mock('@ancore/ui-kit', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when balance is fetching', () => {
    (useAccountBalance as any).mockReturnValue({
      balance: 0,
      isLoading: true,
      error: null,
      refreshBalance: vi.fn(),
    });

    render(<HomeScreen />);

    // Should show skeletons for balance
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);

    // Check for the specific balance skeleton
    expect(skeletons[0].className).toContain('w-32');

    // Should NOT show the balance amount
    expect(screen.queryByText(/XLM/)).toBeNull();
  });

  it('renders balance when loading is complete', () => {
    (useAccountBalance as any).mockReturnValue({
      balance: 125.5,
      isLoading: false,
      error: null,
      refreshBalance: vi.fn(),
    });

    render(<HomeScreen />);

    // Should show the formatted balance
    expect(screen.getByText('125.50 XLM')).toBeDefined();

    // Should NOT show skeletons
    expect(screen.queryByTestId('skeleton')).toBeNull();
  });

  it('renders error state when fetch fails', () => {
    (useAccountBalance as any).mockReturnValue({
      balance: 0,
      isLoading: false,
      error: new Error('Failed to load'),
      refreshBalance: vi.fn(),
    });

    render(<HomeScreen />);

    expect(screen.getByText('Failed to load')).toBeDefined();
    expect(screen.getByText('Try Again')).toBeDefined();
  });
});
