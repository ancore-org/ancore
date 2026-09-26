import type { SessionProposal } from '../../components/SessionApprovalSheet';
import { buildApprovedSessionNamespaces } from '../approve-session';
import { StellarRpcChains } from '../constants';

const mockProposal: SessionProposal = {
  id: 42,
  params: {
    proposer: {
      metadata: {
        name: 'Test dApp',
        description: 'A test decentralized application',
        url: 'https://testdapp.example.com',
        icons: [],
      },
    },
    requiredNamespaces: {
      stellar: {
        chains: [StellarRpcChains.PUBLIC],
        methods: ['stellar_signXDR', 'stellar_signAndSubmitXDR'],
        events: [],
      },
    },
  },
};

describe('buildApprovedSessionNamespaces', () => {
  it('copies proposal namespaces when account context is missing', () => {
    const namespaces = buildApprovedSessionNamespaces({ proposal: mockProposal });

    expect(namespaces).toEqual({
      stellar: {
        accounts: [],
        methods: ['stellar_signXDR', 'stellar_signAndSubmitXDR'],
        events: [],
        chains: [StellarRpcChains.PUBLIC],
      },
    });
  });

  it('includes the active account when chain and account are provided', () => {
    const account = `${StellarRpcChains.PUBLIC}:GABC1234567890`;
    const namespaces = buildApprovedSessionNamespaces({
      proposal: mockProposal,
      activeChain: StellarRpcChains.PUBLIC,
      activeAccount: account,
    });

    expect(namespaces.stellar).toEqual(
      expect.objectContaining({
        accounts: [account],
        chains: [StellarRpcChains.PUBLIC],
        methods: expect.arrayContaining(['stellar_signXDR', 'stellar_signAndSubmitXDR']),
      })
    );
  });
});
