import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TransactionDetail } from '@/screens/TransactionDetail';
import { getTransactionExplorerLink } from '@/utils/explorer-links';

describe('TransactionDetail', () => {
  it('renders all transaction fields for a sent transaction', () => {
    render(
      <TransactionDetail
        transaction={{
          status: 'confirmed',
          type: 'sent',
          from: 'GABC123FROMACCOUNT',
          to: 'GDEF456TOACCOUNT',
          amount: '10',
          assetCode: 'XLM',
          fee: '0.00001 XLM',
          memo: 'Invoice #89',
          timestamp: '2026-01-20T15:45:00.000Z',
          blockNumber: 123456,
          hash: 'ABC123HASHVALUE789XYZ',
          network: 'testnet',
        }}
      />
    );

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Sent 10 XLM')).toBeInTheDocument();
    expect(screen.getByText('GABC123FROMACCOUNT')).toBeInTheDocument();
    expect(screen.getAllByText('GDEF456TOACCOUNT')).toHaveLength(2);
    expect(screen.getByText('0.00001 XLM')).toBeInTheDocument();
    expect(screen.getByText('Invoice #89')).toBeInTheDocument();
    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getByTitle('ABC123HASHVALUE789XYZ')).toBeInTheDocument();
    expect(screen.getByText(/Jan 20, 2026/)).toBeInTheDocument();

    const explorerLink = screen.getByRole('link', {
      name: 'View on Stellar Expert',
    });
    expect(explorerLink).toHaveAttribute(
      'href',
      getTransactionExplorerLink('ABC123HASHVALUE789XYZ', 'testnet')
    );
  });

  it('copies the transaction hash', async () => {
    const user = userEvent.setup();
    const clipboardWrite = vi.spyOn(window.navigator.clipboard, 'writeText');
    clipboardWrite.mockResolvedValue(undefined);

    render(
      <TransactionDetail
        transaction={{
          status: 'pending',
          type: 'payment',
          from: 'GSOURCE',
          to: 'GDESTINATION',
          amount: '23.5',
          fee: '0.00002 XLM',
          memo: null,
          timestamp: '2026-01-21T10:15:00.000Z',
          blockNumber: null,
          hash: 'HASH-TO-COPY',
          network: 'mainnet',
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(clipboardWrite).toHaveBeenCalledWith('HASH-TO-COPY');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.getByText('No memo')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('shows received transactions with the correct counterparty label', () => {
    render(
      <TransactionDetail
        transaction={{
          status: 'failed',
          type: 'received',
          from: 'GSENDER',
          to: 'GME',
          amount: '42',
          assetCode: 'USDC',
          fee: '0.00001 XLM',
          memo: 'Refund',
          timestamp: '2026-02-01T08:00:00.000Z',
          blockNumber: 999,
          hash: 'RECEIVED-HASH',
          network: 'futurenet',
        }}
      />
    );

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Received 42 USDC')).toBeInTheDocument();
    expect(screen.getByText(/From:/)).toBeInTheDocument();

    const explorerLink = screen.getByRole('link', {
      name: 'View on Stellar Expert',
    });
    expect(explorerLink).toHaveAttribute(
      'href',
      getTransactionExplorerLink('RECEIVED-HASH', 'futurenet')
    );
  });
});
