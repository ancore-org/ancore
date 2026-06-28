import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SessionApprovalSheet, SessionProposal } from '../SessionApprovalSheet';
import { WalletKitProvider } from '../../providers/WalletKitProvider';
import { SessionTypes } from '@walletconnect/types';

// ─── Shared mock proposal ────────────────────────────────────────────────────

const mockProposal: SessionProposal = {
  id: 42,
  params: {
    proposer: {
      metadata: {
        name: 'Test dApp',
        description: 'A test decentralized application',
        url: 'https://testdapp.example.com',
        icons: ['https://testdapp.example.com/icon.png'],
      },
    },
    requiredNamespaces: {
      stellar: {
        chains: ['stellar:pubnet'],
        methods: ['stellar_signXDR', 'stellar_signAndSubmitXDR'],
        events: [],
      },
    },
  },
};

// ─── Mock WalletKit factory (mirrors WalletKitProvider.test.tsx style) ────────

const createMockWalletKit = () => {
  let sessions: Record<string, SessionTypes.Struct> = {};
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    init: jest.fn().mockResolvedValue(undefined),
    pair: jest.fn().mockResolvedValue(undefined),
    approveSession: jest
      .fn()
      .mockImplementation(async (params: { id: number; namespaces: Record<string, unknown> }) => {
        sessions[String(params.id)] = {
          topic: `topic-${params.id}`,
          peer: { metadata: { name: 'Test dApp' } },
          namespaces: params.namespaces,
        } as SessionTypes.Struct;
      }),
    rejectSession: jest.fn().mockResolvedValue(undefined),
    disconnectSession: jest.fn().mockImplementation(async (params: { topic: string }) => {
      delete sessions[params.topic];
    }),
    getActiveSessions: jest.fn(() => sessions),
    on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }),
    off: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    }),
    // Helper: trigger an event with an optional argument (e.g., a proposal)
    triggerEvent: (event: string, data?: unknown) => {
      listeners[event]?.forEach((cb) => cb(data));
    },
    _reset: () => {
      sessions = {};
    },
  };
};

// ─── Direct component tests ───────────────────────────────────────────────────

describe('SessionApprovalSheet component', () => {
  describe('proposal rendering', () => {
    it('renders the dApp name', () => {
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={jest.fn()} onReject={jest.fn()} />
      );
      expect(screen.getByText('Test dApp')).toBeInTheDocument();
    });

    it('renders the dApp URL', () => {
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={jest.fn()} onReject={jest.fn()} />
      );
      expect(screen.getByText('https://testdapp.example.com')).toBeInTheDocument();
    });

    it('renders the dApp description', () => {
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={jest.fn()} onReject={jest.fn()} />
      );
      expect(screen.getByText('A test decentralized application')).toBeInTheDocument();
    });

    it('renders the dApp icon', () => {
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={jest.fn()} onReject={jest.fn()} />
      );
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://testdapp.example.com/icon.png');
      expect(img).toHaveAttribute('alt', 'Test dApp icon');
    });

    it('renders required namespace methods', () => {
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={jest.fn()} onReject={jest.fn()} />
      );
      expect(screen.getByText('stellar_signXDR')).toBeInTheDocument();
      expect(screen.getByText('stellar_signAndSubmitXDR')).toBeInTheDocument();
    });

    it('renders optional namespace methods alongside required ones', () => {
      const proposalWithOptional: SessionProposal = {
        ...mockProposal,
        params: {
          ...mockProposal.params,
          optionalNamespaces: {
            stellar: {
              methods: ['stellar_signMessage'],
              events: [],
            },
          },
        },
      };
      render(
        <SessionApprovalSheet
          proposal={proposalWithOptional}
          onApprove={jest.fn()}
          onReject={jest.fn()}
        />
      );
      expect(screen.getByText('stellar_signXDR')).toBeInTheDocument();
      expect(screen.getByText('stellar_signMessage')).toBeInTheDocument();
    });

    it('does not render icon when icons array is empty', () => {
      const proposalNoIcon: SessionProposal = {
        ...mockProposal,
        params: {
          ...mockProposal.params,
          proposer: {
            metadata: {
              ...mockProposal.params.proposer.metadata,
              icons: [],
            },
          },
        },
      };
      render(
        <SessionApprovalSheet
          proposal={proposalNoIcon}
          onApprove={jest.fn()}
          onReject={jest.fn()}
        />
      );
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('renders Connect and Reject buttons', () => {
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={jest.fn()} onReject={jest.fn()} />
      );
      expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
    });

    it('calls onApprove when Connect is clicked', () => {
      const onApprove = jest.fn();
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={onApprove} onReject={jest.fn()} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Connect/i }));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it('calls onReject when Reject is clicked', () => {
      const onReject = jest.fn();
      render(
        <SessionApprovalSheet proposal={mockProposal} onApprove={jest.fn()} onReject={onReject} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Reject/i }));
      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── Integration tests via WalletKitProvider ─────────────────────────────────

describe('SessionApprovalSheet via WalletKitProvider', () => {
  it('does not show the sheet before a session_proposal event', () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div data-testid="app-content">App</div>
      </WalletKitProvider>
    );

    expect(screen.getByTestId('app-content')).toBeInTheDocument();
    expect(screen.queryByText('Test dApp')).not.toBeInTheDocument();
  });

  it('shows the sheet with proposal data when session_proposal fires', async () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div>App</div>
      </WalletKitProvider>
    );

    act(() => {
      mockWalletKit.triggerEvent('session_proposal', mockProposal);
    });

    expect(screen.getByText('Test dApp')).toBeInTheDocument();
    expect(screen.getByText('https://testdapp.example.com')).toBeInTheDocument();
    expect(screen.getByText('stellar_signXDR')).toBeInTheDocument();
    expect(screen.getByText('stellar_signAndSubmitXDR')).toBeInTheDocument();
  });

  it('calls walletKit.approveSession with the proposal id and built namespaces on approve', async () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div>App</div>
      </WalletKitProvider>
    );

    act(() => {
      mockWalletKit.triggerEvent('session_proposal', mockProposal);
    });

    fireEvent.click(screen.getByRole('button', { name: /Connect/i }));

    await waitFor(() => {
      expect(mockWalletKit.approveSession).toHaveBeenCalledWith({
        id: 42,
        namespaces: expect.objectContaining({
          stellar: expect.objectContaining({
            methods: ['stellar_signXDR', 'stellar_signAndSubmitXDR'],
            chains: ['stellar:pubnet'],
          }),
        }),
      });
    });
  });

  it('calls walletKit.rejectSession with id and reason code 4001 on reject', async () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div>App</div>
      </WalletKitProvider>
    );

    act(() => {
      mockWalletKit.triggerEvent('session_proposal', mockProposal);
    });

    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));

    await waitFor(() => {
      expect(mockWalletKit.rejectSession).toHaveBeenCalledWith({
        id: 42,
        reason: {
          code: 4001,
          message: expect.any(String),
        },
      });
    });
  });

  it('dismisses the sheet after approve', async () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div>App</div>
      </WalletKitProvider>
    );

    act(() => {
      mockWalletKit.triggerEvent('session_proposal', mockProposal);
    });

    expect(screen.getByText('Test dApp')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Connect/i }));

    await waitFor(() => {
      expect(screen.queryByText('Test dApp')).not.toBeInTheDocument();
    });
  });

  it('dismisses the sheet after reject', async () => {
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div>App</div>
      </WalletKitProvider>
    );

    act(() => {
      mockWalletKit.triggerEvent('session_proposal', mockProposal);
    });

    expect(screen.getByText('Test dApp')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reject/i }));

    await waitFor(() => {
      expect(screen.queryByText('Test dApp')).not.toBeInTheDocument();
    });
  });

  it('auto-dismisses the sheet after 60 seconds', async () => {
    jest.useFakeTimers();
    const mockWalletKit = createMockWalletKit();

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div>App</div>
      </WalletKitProvider>
    );

    act(() => {
      mockWalletKit.triggerEvent('session_proposal', mockProposal);
    });

    expect(screen.getByText('Test dApp')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await waitFor(() => {
      expect(screen.queryByText('Test dApp')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('unsubscribes from session_proposal when the provider unmounts', () => {
    const mockWalletKit = createMockWalletKit();

    const { unmount } = render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit as any}>
        <div>App</div>
      </WalletKitProvider>
    );

    expect(mockWalletKit.on).toHaveBeenCalledWith('session_proposal', expect.any(Function));

    unmount();

    expect(mockWalletKit.off).toHaveBeenCalledWith('session_proposal', expect.any(Function));
  });
});
