import { render, screen } from '@testing-library/react';

import { parseSignXdrRequest, SignXdrApprovalSheet } from '../SignXdrApprovalSheet';

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

describe('parseSignXdrRequest', () => {
  const validEvent = {
    id: 123,
    topic: 'topic-abc',
    method: 'stellar_signXDR',
    params: { xdr: 'encoded-xdr' },
    session: request.session,
  };

  it('parses valid requests and trims the topic', () => {
    const result = parseSignXdrRequest({ ...validEvent, topic: '  topic-abc  ' });

    expect(result.id).toBe(123);
    expect(result.topic).toBe('topic-abc');
    expect(result.method).toBe('stellar_signXDR');
  });

  it('accepts numeric string IDs', () => {
    expect(parseSignXdrRequest({ ...validEvent, id: '456' }).id).toBe(456);
  });

  it.each([undefined, null, 'abc', '', '   ', NaN, 1.5, '1.5', true, []])(
    'throws for invalid request ID %p',
    (id) => {
      expect(() => parseSignXdrRequest({ ...validEvent, id })).toThrow(
        'Invalid or missing WalletConnect request id'
      );
    }
  );

  it.each([undefined, null, '', '   ', 123])('throws for invalid topic %p', (topic) => {
    expect(() => parseSignXdrRequest({ ...validEvent, topic })).toThrow(
      'Invalid or missing WalletConnect request topic'
    );
  });
});
