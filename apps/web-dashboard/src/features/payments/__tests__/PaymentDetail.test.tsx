import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { mapMerchantMetadata } from '../../../components/merchant/merchant-metadata';
import { PaymentDetail } from '../PaymentDetail';
import type { Transaction } from '../../../components/transactions/transaction-types';

const payment: Transaction = {
  id: 'tx-merchant',
  occurredAt: '2026-04-24T10:00:00.000Z',
  type: 'payment',
  status: 'completed',
  amount: 142.5,
  counterparty: 'Acme Treasury',
  memo: 'Invoice 1042',
  merchant: mapMerchantMetadata({
    merchant_name: 'Acme Treasury',
    merchant_verification_status: 'verified',
  }),
};

describe('PaymentDetail', () => {
  it('renders merchant verification details with an accessible badge', () => {
    render(<PaymentDetail transaction={payment} />);

    expect(screen.getByRole('heading', { name: 'Acme Treasury' })).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Acme Treasury merchant verification: Verified' })
    ).toBeInTheDocument();
  });
});
