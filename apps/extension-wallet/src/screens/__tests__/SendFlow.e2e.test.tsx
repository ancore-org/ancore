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
      network: 'testnet' as const,
    })),
    authenticatePassword: vi.fn(async (password: string) => password === 'wallet-password'),
    signTransaction: vi.fn(async () => 'signed_payload'),
    submitTransaction: vi.fn(async () => ({ txId: 'tx_demo_123' })),
    fetchTransactionStatus: vi.fn(async () => statusQueue.shift() ?? 'confirmed'),
    resolveHandle: vi.fn(async (handle) =>
      handle === '@alice'
        ? {
            handle,
            accountAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            displayName: 'Alice',
          }
        : null
    ),
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
    await user.click(screen.getByRole('button', { name: /Review/ }));

    expect(await screen.findByText(/Review Transaction/i)).toBeInTheDocument();
    await user.click(screen.getByText('Confirm Recipient'));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByText(/Sign Transaction/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Wallet Password/i), 'wallet-password');
    await user.click(screen.getByRole('button', { name: /Sign & submit/i }));

    expect(await screen.findByText(/Transaction Result/i)).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.getByText('Confirmed')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  }, 15000);

  it('resolves @username handles before review', async () => {
    const service = createService();
    const user = userEvent.setup();

    render(<SendScreen balance={100} service={service} pollIntervalMs={10} />);

    await user.type(screen.getByLabelText('Recipient'), '@Alice');
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: /Review/ }));

    expect(await screen.findByText(/Review Transaction/i)).toBeInTheDocument();
    expect(screen.getByText(/@alice/i)).toBeInTheDocument();
    expect(service.resolveHandle).toHaveBeenCalledWith('@alice');
  });

  it('shows a clear error when a handle is not found', async () => {
    const service = createService();
    const user = userEvent.setup();

    render(<SendScreen balance={100} service={service} pollIntervalMs={10} />);

    await user.type(screen.getByLabelText('Recipient'), '@missing');
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: /Review/ }));

    expect(await screen.findByText('Handle not found')).toBeInTheDocument();
    expect(screen.queryByText('Review transaction')).not.toBeInTheDocument();
  });
});
