import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReviewScreen } from '../ReviewScreen';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';
import { checkMemoRequired } from '@ancore/stellar';

vi.mock('@ancore/stellar', () => ({
  checkMemoRequired: vi.fn().mockResolvedValue(false),
}));

const transaction: SendTransactionDraft = {
  to: 'GBHHL5543KUJHAWEBZZZIJHQP2EMYY3YPZS2WRJDQ7X6G5HC77625CW7',
  amount: '10',
  fee: {
    baseFee: '0.0000100',
    totalFee: '0.0000100',
    network: 'testnet',
  },
  total: '10.0000100',
};

describe('ReviewScreen simulation gating', () => {
  it('disables continue while simulation is loading', async () => {
    const user = userEvent.setup();

    render(
      <ReviewScreen
        transaction={transaction}
        simulation={{ status: 'loading' }}
        onBack={() => undefined}
        onConfirm={() => undefined}
      />
    );

    await user.click(screen.getByText('Confirm Recipient'));

    expect(screen.getByRole('button', { name: /Continue to Sign/i })).toBeDisabled();
  });

  it('disables continue when simulation fails', async () => {
    const user = userEvent.setup();

    render(
      <ReviewScreen
        transaction={transaction}
        simulation={{ status: 'error', message: 'HostError: contract trapped' }}
        onBack={() => undefined}
        onConfirm={() => undefined}
      />
    );

    await user.click(screen.getByText('Confirm Recipient'));

    expect(screen.getByRole('button', { name: /Continue to Sign/i })).toBeDisabled();
    expect(screen.getByTestId('simulation-error')).toHaveTextContent('HostError: contract trapped');
  });

  it('shows simulated fee and enables continue after successful simulation', async () => {
    const user = userEvent.setup();

    render(
      <ReviewScreen
        transaction={transaction}
        simulation={{
          status: 'success',
          simulatedFee: '0.0000600',
          outcome: 'success',
        }}
        onBack={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByTestId('review-network-fee')).toHaveTextContent('0.0000600 XLM');
    expect(screen.getByTestId('review-total')).toHaveTextContent('10.0000600 XLM');

    await user.click(screen.getByText('Confirm Recipient'));
    expect(screen.getByRole('button', { name: /Continue to Sign/i })).toBeEnabled();
  });
});

describe('ReviewScreen memo-required validation (#1448)', () => {
  const mainnetTx: SendTransactionDraft = {
    to: 'GBHHL5543KUJHAWEBZZZIJHQP2EMYY3YPZS2WRJDQ7X6G5HC77625CW7',
    amount: '10',
    fee: {
      baseFee: '0.0000100',
      totalFee: '0.0000100',
      network: 'mainnet',
    },
    total: '10.0000100',
  };

  it('displays warning banner and disables Continue button when memo is required on mainnet and note is missing', async () => {
    vi.mocked(checkMemoRequired).mockResolvedValueOnce(true);
    const user = userEvent.setup();

    render(
      <ReviewScreen transaction={mainnetTx} onBack={() => undefined} onConfirm={() => undefined} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('memo-required-warning')).toBeInTheDocument();
    });

    expect(screen.getByText(/Memo required for this address on mainnet/i)).toBeInTheDocument();

    await user.click(screen.getByText('Confirm Recipient'));
    expect(screen.getByRole('button', { name: /Continue to Sign/i })).toBeDisabled();
  });

  it('allows Continue when memo is required on mainnet but note is provided', async () => {
    vi.mocked(checkMemoRequired).mockResolvedValueOnce(true);
    const user = userEvent.setup();

    render(
      <ReviewScreen
        transaction={{ ...mainnetTx, note: '12345678' }}
        onBack={() => undefined}
        onConfirm={() => undefined}
      />
    );

    // Warning banner should NOT be present
    expect(screen.queryByTestId('memo-required-warning')).not.toBeInTheDocument();

    await user.click(screen.getByText('Confirm Recipient'));
    expect(screen.getByRole('button', { name: /Continue to Sign/i })).toBeEnabled();
  });
});
