import { render, screen } from '@testing-library/react';

import { SignXdrApprovalSheet } from '../SignXdrApprovalSheet';

const request = {
  id: 1,
  topic: 'topic-1',
  method: 'stellar_signXDR' as const,
  params: { description: 'Send payment' },
  session: {
    topic: 'topic-1',
    peer: { metadata: { name: 'Test dApp', url: 'https://dapp.test' } },
    namespaces: {},
  },
};

describe('SignXdrApprovalSheet', () => {
  it('renders approval UI', () => {
    render(
      <SignXdrApprovalSheet
        request={request as any}
        status="pending"
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getByText('Approve Transaction')).toBeInTheDocument();
    expect(screen.getByText('Test dApp')).toBeInTheDocument();
  });

  it('renders success state', () => {
    render(
      <SignXdrApprovalSheet
        request={request as any}
        status="success"
        onApprove={jest.fn()}
        onReject={jest.fn()}
      />
    );

    expect(screen.getByText('Transaction Signed')).toBeInTheDocument();
  });
});
