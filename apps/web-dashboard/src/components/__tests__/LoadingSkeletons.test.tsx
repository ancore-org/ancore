import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  AccountSummarySkeleton,
  TransactionListSkeleton,
  DashboardPageSkeleton,
} from '../LoadingSkeletons';

vi.mock('@ancore/ui-kit', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Skeleton: ({ className, ...rest }: any) => (
    <div data-testid="skeleton" className={className} aria-hidden="true" {...rest} />
  ),
}));

describe('LoadingSkeletons', () => {
  describe('AccountSummarySkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<AccountSummarySkeleton />);
      expect(container.firstChild).toBeTruthy();
    });

    it('renders skeleton placeholders', () => {
      render(<AccountSummarySkeleton />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('TransactionListSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<TransactionListSkeleton />);
      expect(container.firstChild).toBeTruthy();
    });

    it('renders 5 row skeletons', () => {
      render(<TransactionListSkeleton />);
      const skeletons = screen.getAllByTestId('skeleton');
      // Each row has 4 skeleton elements, plus 1 header = 21 total
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('DashboardPageSkeleton', () => {
    it('renders with data-testid', () => {
      render(<DashboardPageSkeleton />);
      expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
    });

    it('renders metric widget skeletons and list skeletons', () => {
      render(<DashboardPageSkeleton />);
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(10);
    });
  });
});
