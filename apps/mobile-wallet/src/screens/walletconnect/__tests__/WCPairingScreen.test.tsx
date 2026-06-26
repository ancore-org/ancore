import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SessionTypes } from '@walletconnect/types';

import { WalletKitProvider } from '../../../providers/WalletKitProvider';
import { WCPairingScreen } from '../WCPairingScreen';

const createMockWalletKit = () => {
  const listeners: Record<string, Array<() => void>> = {};

  return {
    init: jest.fn().mockResolvedValue(undefined),
    pair: jest.fn().mockResolvedValue(undefined),
    approveSession: jest.fn().mockResolvedValue(undefined),
    rejectSession: jest.fn().mockResolvedValue(undefined),
    disconnectSession: jest.fn().mockResolvedValue(undefined),
    getActiveSessions: jest.fn(() => [] as SessionTypes.Struct[]),
    on: jest.fn((event: string, callback: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(callback);
    }),
    off: jest.fn((event: string, callback: () => void) => {
      listeners[event] = (listeners[event] ?? []).filter((cb) => cb !== callback);
    }),
    triggerEvent: (event: string) => {
      listeners[event]?.forEach((callback) => callback());
    },
  };
};

describe('WCPairingScreen', () => {
  it('calls walletKit.pair with the deep link uri on mount', async () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <WCPairingScreen uri="wc:abc123def456" />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(mockWalletKit.pair).toHaveBeenCalledWith({ uri: 'wc:abc123def456' });
    });
  });

  it('shows pairing progress while waiting for session_proposal', async () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <WCPairingScreen uri="wc:abc123def456" />
      </WalletKitProvider>
    );

    expect(screen.getByText('Connecting to dApp…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Waiting for session proposal…')).toBeInTheDocument();
    });
  });

  it('shows proposal received after session_proposal event', async () => {
    const mockWalletKit = createMockWalletKit();
    const onSessionProposal = jest.fn();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <WCPairingScreen uri="wc:abc123def456" onSessionProposal={onSessionProposal} />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(mockWalletKit.pair).toHaveBeenCalled();
    });

    mockWalletKit.triggerEvent('session_proposal');

    await waitFor(() => {
      expect(screen.getByText('Session proposal received')).toBeInTheDocument();
    });
    expect(onSessionProposal).toHaveBeenCalled();
  });

  it('shows an error when pairing fails', async () => {
    const mockWalletKit = createMockWalletKit();
    mockWalletKit.pair.mockRejectedValue(new Error('Pairing rejected'));

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <WCPairingScreen uri="wc:abc123def456" />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Pairing rejected');
    });
  });
});
