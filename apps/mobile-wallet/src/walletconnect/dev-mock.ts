import type { SessionTypes } from '@walletconnect/types';

import type { SessionProposal } from '../components/SessionApprovalSheet';
import { StellarRpcChains } from './constants';

export const DEV_MOCK_PAIRING_URI_FRAGMENT = 'mock-pairing-uri';

export const DEV_MOCK_PROPOSAL_ID = 9_001;
export const DEV_MOCK_SESSION_TOPIC = 'dev-mock-wc-session';

export const isDevMockPairingUri = (uri: string): boolean =>
  typeof __DEV__ !== 'undefined' && __DEV__ && uri.includes(DEV_MOCK_PAIRING_URI_FRAGMENT);

export const isDevMockSessionProposal = (proposal: { id: number }): boolean =>
  typeof __DEV__ !== 'undefined' && __DEV__ && proposal.id === DEV_MOCK_PROPOSAL_ID;

export const createDevMockSessionProposal = (): SessionProposal => ({
  id: DEV_MOCK_PROPOSAL_ID,
  params: {
    proposer: {
      metadata: {
        name: 'E2E Mock dApp',
        description: 'Maestro WalletConnect pairing mock',
        url: 'https://e2e.ancore.dev',
        icons: [],
      },
    },
    requiredNamespaces: {
      stellar: {
        chains: [StellarRpcChains.TESTNET],
        methods: [
          'stellar_signXDR',
          'stellar_signAndSubmitXDR',
          'stellar_signMessage',
          'stellar_signAuthEntry',
        ],
        events: [],
      },
    },
  },
});

export const createDevMockSession = (activeAccount?: string): SessionTypes.Struct =>
  ({
    topic: DEV_MOCK_SESSION_TOPIC,
    relay: { protocol: 'irn' },
    expiry: Math.floor(Date.now() / 1000) + 86_400,
    acknowledged: true,
    controller: 'mock-controller',
    pairingTopic: 'mock-pairing-topic',
    requiredNamespaces: {},
    optionalNamespaces: {},
    self: {
      publicKey: 'mock-self-key',
      metadata: {
        name: 'Ancore Wallet Dev',
        description: 'Dev mock session',
        url: 'https://e2e.ancore.dev',
        icons: [],
      },
    },
    namespaces: {
      stellar: {
        accounts: activeAccount ? [activeAccount] : [],
        chains: [StellarRpcChains.TESTNET],
        methods: [
          'stellar_signXDR',
          'stellar_signAndSubmitXDR',
          'stellar_signMessage',
          'stellar_signAuthEntry',
        ],
        events: [],
      },
    },
    peer: {
      publicKey: 'mock-peer-key',
      metadata: {
        name: 'E2E Mock dApp',
        description: 'Maestro WalletConnect pairing mock',
        url: 'https://e2e.ancore.dev',
        icons: [],
      },
    },
  }) as SessionTypes.Struct;
