import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SignAuthEntryApprovalSheet,
  parseSignAuthEntryRequest,
} from '../SignAuthEntryApprovalSheet';
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

describe('parseSignAuthEntryRequest', () => {
  const validEvent = {
    id: 123,
    topic: 'topic-abc',
    params: { authEntry: 'AAAA' },
    session: mockSession,
  };

  it('parses valid event correctly', () => {
    const result = parseSignAuthEntryRequest(validEvent);
    expect(result.request.id).toBe(123);
    expect(result.request.topic).toBe('topic-abc');
    expect(result.request.method).toBe('stellar_signAuthEntry');
    expect(result.parsed.entryXdr).toBe('AAAA');
  });

  it('accepts numeric string id', () => {
    const result = parseSignAuthEntryRequest({ ...validEvent, id: '456' });
    expect(result.request.id).toBe(456);
  });

  it('throws for missing id', () => {
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: undefined })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: null })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
  });

  it('throws for non-numeric or invalid id', () => {
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: 'abc' })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: NaN })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: true })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: '' })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: '   ' })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: [] })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
  });

  it('throws for missing or empty topic', () => {
    expect(() => parseSignAuthEntryRequest({ ...validEvent, topic: undefined })).toThrow(
      'Invalid or missing WalletConnect request topic'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, topic: '' })).toThrow(
      'Invalid or missing WalletConnect request topic'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, topic: '   ' })).toThrow(
      'Invalid or missing WalletConnect request topic'
    );
  });

  it('throws for missing authEntry', () => {
    expect(() => parseSignAuthEntryRequest({ ...validEvent, params: {} })).toThrow(
      'Missing authEntry parameter'
    );
  });

  it('throws for floating point id', () => {
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: 123.45 })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, id: '123.45' })).toThrow(
      'Invalid or missing WalletConnect request id'
    );
  });

  it('trims topic', () => {
    const result = parseSignAuthEntryRequest({ ...validEvent, topic: '  topic-abc  ' });
    expect(result.request.topic).toBe('topic-abc');
  });

  it('throws for missing or malformed session', () => {
    expect(() => parseSignAuthEntryRequest({ ...validEvent, session: undefined })).toThrow(
      'Invalid or missing WalletConnect session'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, session: null })).toThrow(
      'Invalid or missing WalletConnect session'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, session: [] })).toThrow(
      'Invalid or missing WalletConnect session'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, session: {} })).toThrow(
      'Invalid or missing WalletConnect session'
    );
    expect(() => parseSignAuthEntryRequest({ ...validEvent, session: { topic: 'a' } })).toThrow(
      'Invalid or missing WalletConnect session'
    );
  });

  it('throws for session with non-string topic or invalid peer', () => {
    expect(() =>
      parseSignAuthEntryRequest({ ...validEvent, session: { topic: 123, peer: {} } })
    ).toThrow('Invalid or missing WalletConnect session');
    expect(() =>
      parseSignAuthEntryRequest({ ...validEvent, session: { topic: 'a', peer: null } })
    ).toThrow('Invalid or missing WalletConnect session');
    expect(() =>
      parseSignAuthEntryRequest({ ...validEvent, session: { topic: 'a', peer: [] } })
    ).toThrow('Invalid or missing WalletConnect session');
  });

  it('accepts a minimal session with empty peer metadata', () => {
    expect(() =>
      parseSignAuthEntryRequest({ ...validEvent, session: { topic: 'a', peer: {} } })
    ).not.toThrow();
  });
});
