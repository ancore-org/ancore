import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AccountSelector } from '../AccountSelector';
import type { AccountData } from '../../types/dashboard';

const mockAccounts: AccountData[] = [
  {
    address: 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ',
    balance: 1250.75,
    status: 'active',
    lastActivity: new Date('2026-04-24T10:00:00Z'),
  },
  {
    address: 'GDEF789GHI012JKL345MNO678PQR901STU234VWX567YZA890BCD',
    balance: 845.2,
    status: 'active',
    lastActivity: new Date('2026-04-23T15:30:00Z'),
  },
];

const defaultProps = {
  accounts: mockAccounts,
  currentAccount: mockAccounts[0],
  onAccountChange: vi.fn(),
};

describe('AccountSelector', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it('renders the current account address in truncated format', () => {
    render(<AccountSelector {...defaultProps} />);

    expect(screen.getByText('GABC12...34YZ')).toBeInTheDocument();
  });

  it('shows "Select Account" when no current account is selected', () => {
    render(<AccountSelector {...defaultProps} currentAccount={null} />);

    expect(screen.getByText('Select Account')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    expect(screen.getByPlaceholderText('Search accounts...')).toBeInTheDocument();
    expect(screen.getAllByText('GABC12...34YZ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GDEF78...0BCD').length).toBeGreaterThan(0);
  });

  it('filters accounts based on search query', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    const searchInput = screen.getByPlaceholderText('Search accounts...');
    await user.type(searchInput, 'GDEF');

    expect(screen.queryByRole('option', { name: /GABC12...34YZ/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /GDEF78...0BCD/i })).toBeInTheDocument();
  });

  it('shows "No accounts found" when search has no results', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    const searchInput = screen.getByPlaceholderText('Search accounts...');
    await user.type(searchInput, 'NONEXISTENT');

    expect(screen.getByText('No accounts found')).toBeInTheDocument();
  });

  it('calls onAccountChange when an account is selected', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));
    await user.click(screen.getByText('GDEF78...0BCD'));

    expect(defaultProps.onAccountChange).toHaveBeenCalledWith(mockAccounts[1]);
  });

  it('closes dropdown when clicking outside', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    expect(screen.getByPlaceholderText('Search accounts...')).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search accounts...')).not.toBeInTheDocument();
    });
  });

  it('supports keyboard navigation - arrow keys', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    const searchInput = screen.getByPlaceholderText('Search accounts...');
    searchInput.focus();

    await user.keyboard('{ArrowDown}');

    const firstAccount = screen.getByRole('option', { name: /GABC12...34YZ/i });
    expect(firstAccount.className).toMatch(/bg-accent(\/50)?/);

    await user.keyboard('{ArrowDown}');

    const secondAccount = screen.getByRole('option', { name: /GDEF78...0BCD/i });
    expect(secondAccount.className).toMatch(/bg-accent(\/50)?/);
  });

  it('supports keyboard navigation - Enter to select', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    const searchInput = screen.getByPlaceholderText('Search accounts...');
    searchInput.focus();

    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(defaultProps.onAccountChange).toHaveBeenCalledWith(mockAccounts[0]);
  });

  it('supports keyboard navigation - Escape to close', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    expect(screen.getByPlaceholderText('Search accounts...')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search accounts...');
    searchInput.focus();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search accounts...')).not.toBeInTheDocument();
    });
  });

  it('opens dropdown with Enter key when closed', async () => {
    render(<AccountSelector {...defaultProps} />);

    const button = screen.getByRole('button', { name: /select account/i });
    button.focus();

    await user.keyboard('{Enter}');

    expect(screen.getByPlaceholderText('Search accounts...')).toBeInTheDocument();
  });

  it('shows checkmark for current account', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    const checkIcon = screen.getByRole('option', { name: /GABC12...34YZ/i }).querySelector('svg');
    expect(checkIcon).toBeInTheDocument();
  });

  it('displays account balance and status in dropdown', async () => {
    render(<AccountSelector {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /select account/i }));

    expect(screen.getByText(/Balance: 1250.75.*Status: active/)).toBeInTheDocument();
    expect(screen.getByText(/Balance: 845.20.*Status: active/)).toBeInTheDocument();
  });
});
