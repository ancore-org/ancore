import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReviewScreen } from '../ReviewScreen';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';

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
