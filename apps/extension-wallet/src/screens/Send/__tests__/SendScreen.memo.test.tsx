import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SendScreen } from '../SendScreen';
import * as memoCheck from '@/utils/memoCheck';
import { useSettingsStore } from '@/stores/settings';

vi.mock('@/utils/memoCheck', () => ({
  isMemoRequired: vi.fn(),
}));

vi.mock('@/router/AuthGuard', () => ({
  useExtensionAuth: () => ({
    authState: {
      accountAddress: 'GCSENDER00000000000000000000000000000000000000000000000',
      hasOnboarded: true,
      walletName: 'Test Wallet',
    },
  }),
}));

vi.mock('@/hooks/useRecentRecipients', () => ({
  useRecentRecipients: () => ({
    recipients: [],
    addRecipient: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/services/ai-agent-client', () => ({
  useAiAgent: () => ({
    client: null,
    isAvailable: false,
  }),
}));

describe('SendScreen mainnet memo-required validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSettingsStore.setState({ network: 'mainnet' });
  });

  it('shows memo warning and disables Continue button when recipient requires memo on mainnet and no memo entered', async () => {
    vi.mocked(memoCheck.isMemoRequired).mockResolvedValue(true);

    render(<SendScreen balance={100} />);

    // Type recipient address
    const recipientInput = screen.getByPlaceholderText(/@username or G…/i);
    fireEvent.change(recipientInput, {
      target: { value: 'GCEXCHANGE000000000000000000000000000000000000000000000000' },
    });

    await waitFor(() => {
      expect(memoCheck.isMemoRequired).toHaveBeenCalledWith(
        'GCEXCHANGE000000000000000000000000000000000000000000000000'
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/This exchange requires a memo/i)).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it('clears warning when user types a memo', async () => {
    vi.mocked(memoCheck.isMemoRequired).mockResolvedValue(true);

    render(<SendScreen balance={100} />);

    const recipientInput = screen.getByPlaceholderText(/@username or G…/i);
    fireEvent.change(recipientInput, {
      target: { value: 'GCEXCHANGE000000000000000000000000000000000000000000000000' },
    });

    await waitFor(() => {
      expect(screen.getByText(/This exchange requires a memo/i)).toBeInTheDocument();
    });

    const memoInput = screen.getByPlaceholderText(/Memo \(optional\)/i);
    fireEvent.change(memoInput, { target: { value: '12345678' } });

    await waitFor(() => {
      expect(screen.queryByText(/This exchange requires a memo/i)).not.toBeInTheDocument();
    });
  });

  it('does not show warning on testnet even if memo check would be true', async () => {
    useSettingsStore.setState({ network: 'testnet' });
    vi.mocked(memoCheck.isMemoRequired).mockResolvedValue(true);

    render(<SendScreen balance={100} />);

    const recipientInput = screen.getByPlaceholderText(/@username or G…/i);
    fireEvent.change(recipientInput, {
      target: { value: 'GCEXCHANGE000000000000000000000000000000000000000000000000' },
    });

    // Should not call isMemoRequired on testnet
    expect(memoCheck.isMemoRequired).not.toHaveBeenCalled();
    expect(screen.queryByText(/This exchange requires a memo/i)).not.toBeInTheDocument();
  });
});
