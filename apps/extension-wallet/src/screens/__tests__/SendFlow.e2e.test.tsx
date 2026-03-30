import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SendScreen } from '@/screens/Send/SendScreen';
import type { SendService, TxStatus } from '@/hooks/useSendTransaction';

function createService(): SendService {
  const statusQueue: TxStatus[] = ['pending', 'confirmed'];

  return {
    estimateFee: vi.fn(async () => ({
      baseFee: '0.0000100',
      totalFee: '0.0000200',
      network: 'testnet',
    })),
    authenticatePassword: vi.fn(async (password: string) => password === 'wallet-password'),
    signTransaction: vi.fn(async () => 'signed_payload'),
    submitTransaction: vi.fn(async () => ({ txId: 'tx_demo_123' })),
    fetchTransactionStatus: vi.fn(async () => statusQueue.shift() ?? 'confirmed'),
  };
}

describe('Send flow e2e', () => {
  it('completes form -> review -> confirm -> submit -> confirmed', async () => {
    const service = createService();
    const user = userEvent.setup();

    render(<SendScreen balance={100} service={service} pollIntervalMs={10} />);

    await user.type(
      screen.getByLabelText('Recipient'),
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    );
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(await screen.findByText('Review transaction')).toBeInTheDocument();
    expect(screen.getByText('0.0000200 XLM')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Confirm transaction')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Wallet password'), 'wallet-password');
    await user.click(screen.getByRole('button', { name: 'Sign & submit' }));

    expect(await screen.findByText('Transaction status')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByText('Confirmed')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
