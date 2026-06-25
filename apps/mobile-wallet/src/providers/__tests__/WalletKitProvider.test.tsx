import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { WalletKitProvider, useWalletConnect } from '../WalletKitProvider';
import { SessionTypes } from '@walletconnect/types';

// Mock WalletKit implementation for testing
const createMockWalletKit = () => {
  let sessions: Record<string, SessionTypes.Struct> = {};
  const listeners: Record<string, (() => void)[]> = {};

  return {
    init: jest.fn().mockResolvedValue(undefined),
    pair: jest.fn().mockResolvedValue(undefined),
    approveSession: jest.fn().mockImplementation(async (params: any) => {
      sessions[params.id] = {
        topic: `topic-${params.id}`,
        peer: { metadata: { name: 'Test dApp' } },
        namespaces: params.namespaces,
      } as SessionTypes.Struct;
    }),
    rejectSession: jest.fn().mockResolvedValue(undefined),
    disconnectSession: jest.fn().mockImplementation(async (params: any) => {
      delete sessions[params.topic];
    }),
    getActiveSessions: jest.fn(() => sessions),
    on: jest.fn((event: string, callback: () => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }),
    off: jest.fn((event: string, callback: () => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    }),
    // Helper for tests to trigger events
    triggerEvent: (event: string) => {
      listeners[event]?.forEach((cb) => cb());
    },
  };
};

describe('WalletKitProvider', () => {
  it('should initialize with provided walletKit instance', async () => {
    const mockWalletKit = createMockWalletKit() as any;

    const TestComponent = () => {
      const { isInitialized } = useWalletConnect();
      return <div>{isInitialized ? 'Initialized' : 'Not Initialized'}</div>;
    };

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <TestComponent />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Initialized')).toBeInTheDocument();
    });
  });

  it('should pair with a URI', async () => {
    const mockWalletKit = createMockWalletKit() as any;

    const TestComponent = () => {
      const { pair, isInitialized } = useWalletConnect();

      React.useEffect(() => {
        if (isInitialized) {
          pair('wc:test-uri');
        }
      }, [isInitialized, pair]);

      return <div>Test</div>;
    };

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <TestComponent />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(mockWalletKit.pair).toHaveBeenCalledWith({ uri: 'wc:test-uri' });
    });
  });

  it('should approve a session proposal', async () => {
    const mockWalletKit = createMockWalletKit() as any;

    const TestComponent = () => {
      const { approveSession, isInitialized } = useWalletConnect();

      React.useEffect(() => {
        if (isInitialized) {
          const proposal = {
            id: 123,
            params: {
              requiredNamespaces: {
                stellar: {
                  chains: ['stellar:pubnet'],
                  methods: ['stellar_signXDR'],
                  events: [],
                },
              },
            },
          };
          approveSession(proposal);
        }
      }, [isInitialized, approveSession]);

      return <div>Test</div>;
    };

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <TestComponent />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(mockWalletKit.approveSession).toHaveBeenCalled();
    });
  });

  it('should reject a session proposal', async () => {
    const mockWalletKit = createMockWalletKit() as any;

    const TestComponent = () => {
      const { rejectSession, isInitialized } = useWalletConnect();

      React.useEffect(() => {
        if (isInitialized) {
          const proposal = { id: 123 };
          rejectSession(proposal);
        }
      }, [isInitialized, rejectSession]);

      return <div>Test</div>;
    };

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <TestComponent />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(mockWalletKit.rejectSession).toHaveBeenCalledWith({
        id: 123,
        reason: {
          code: 4001,
          message: 'User rejected the session proposal',
        },
      });
    });
  });

  it('should disconnect a session', async () => {
    const mockWalletKit = createMockWalletKit() as any;

    const TestComponent = () => {
      const { disconnectSession, isInitialized } = useWalletConnect();

      React.useEffect(() => {
        if (isInitialized) {
          disconnectSession('test-topic');
        }
      }, [isInitialized, disconnectSession]);

      return <div>Test</div>;
    };

    render(
      <WalletKitProvider projectId="test-project-id" walletKitInstance={mockWalletKit}>
        <TestComponent />
      </WalletKitProvider>
    );

    await waitFor(() => {
      expect(mockWalletKit.disconnectSession).toHaveBeenCalledWith({
        topic: 'test-topic',
        reason: {
          code: 6000,
          message: 'User disconnected the session',
        },
      });
    });
  });

  it('should throw error when useWalletConnect is used outside provider', () => {
    const TestComponent = () => {
      try {
        useWalletConnect();
        return <div>No Error</div>;
      } catch {
        return <div>Error Thrown</div>;
      }
    };

    render(<TestComponent />);

    expect(screen.getByText('Error Thrown')).toBeInTheDocument();
  });
});
