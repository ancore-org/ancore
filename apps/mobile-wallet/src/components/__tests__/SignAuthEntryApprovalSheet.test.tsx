import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignAuthEntryApprovalSheet } from '../SignAuthEntryApprovalSheet';
import type { SessionTypes } from '@walletconnect/types';

const mockSession = {
  topic: 'topic-1',
  peer: { metadata: { name: 'Soroban dApp', url: 'https://dapp.example' } },
} as SessionTypes.Struct;

describe('SignAuthEntryApprovalSheet', () => {
  it('renders contract and function details', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();

    render(
      <SignAuthEntryApprovalSheet
        request={{
          id: 1,
          topic: 'topic-1',
          method: 'stellar_signAuthEntry',
          params: { authEntry: 'AAAA' },
          session: mockSession,
        }}
        parsed={{
          contractId: 'CABCDEF',
          functionName: 'transfer',
          subInvocations: 1,
          rootInvocationPresent: true,
          entryXdr: 'AAAA',
        }}
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    expect(screen.getByTestId('sign-auth-entry-sheet')).toBeInTheDocument();
    expect(screen.getByText('Soroban dApp')).toBeInTheDocument();
    expect(screen.getByText(/transfer/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalled();
  });
});
