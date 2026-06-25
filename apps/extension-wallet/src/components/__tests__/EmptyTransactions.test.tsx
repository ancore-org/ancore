import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyTransactions } from '../EmptyTransactions';

describe('EmptyTransactions', () => {
  describe('variant=all', () => {
    it('shows no-transactions copy and Add Funds CTA', () => {
      const onReceive = vi.fn();
      render(<EmptyTransactions variant="all" onReceive={onReceive} />);
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
      expect(screen.getByText(/Send or receive XLM/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add funds/i })).toBeInTheDocument();
    });

    it('calls onReceive when Add Funds is clicked', async () => {
      const user = userEvent.setup();
      const onReceive = vi.fn();
      render(<EmptyTransactions variant="all" onReceive={onReceive} />);
      await user.click(screen.getByRole('button', { name: /add funds/i }));
      expect(onReceive).toHaveBeenCalledOnce();
    });
  });

  describe('variant=sent', () => {
    it('shows sent-specific copy and Reset filter CTA', () => {
      render(<EmptyTransactions variant="sent" />);
      expect(screen.getByText('No sent transactions')).toBeInTheDocument();
      expect(screen.getByText(/Sent payments will appear here/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset filter/i })).toBeInTheDocument();
    });

    it('calls onResetFilter when Reset filter is clicked', async () => {
      const user = userEvent.setup();
      const onResetFilter = vi.fn();
      render(<EmptyTransactions variant="sent" onResetFilter={onResetFilter} />);
      await user.click(screen.getByRole('button', { name: /reset filter/i }));
      expect(onResetFilter).toHaveBeenCalledOnce();
    });
  });

  describe('variant=received', () => {
    it('shows received-specific copy', () => {
      render(<EmptyTransactions variant="received" />);
      expect(screen.getByText('No received transactions')).toBeInTheDocument();
      expect(screen.getByText(/Incoming payments will appear here/i)).toBeInTheDocument();
    });
  });

  describe('variant=failed', () => {
    it('shows failed-specific copy with positive tone', () => {
      render(<EmptyTransactions variant="failed" />);
      expect(screen.getByText('No failed transactions')).toBeInTheDocument();
      expect(screen.getByText(/All your transactions succeeded/i)).toBeInTheDocument();
    });
  });

  it('has accessible role=status and aria-live=polite', () => {
    const { container } = render(<EmptyTransactions variant="all" />);
    const el = container.querySelector('[role="status"]');
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute('aria-live', 'polite');
  });
});
