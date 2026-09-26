import { buildApprovedNamespaces } from '@walletconnect/utils';

import type { SessionProposal } from '../components/SessionApprovalSheet';
import {
  STELLAR_NAMESPACE_EVENTS,
  STELLAR_NAMESPACE_METHODS,
  type StellarRpcChain,
} from './constants';

type NamespaceEntry = {
  chains?: string[];
  methods?: string[];
  events?: string[];
};

const copyProposalNamespaces = (
  requiredNamespaces: Record<string, NamespaceEntry>
): Record<
  string,
  { accounts: string[]; methods: string[]; events: string[]; chains: string[] }
> => {
  const approvedNamespaces: Record<
    string,
    { accounts: string[]; methods: string[]; events: string[]; chains: string[] }
  > = {};

  for (const [key, namespace] of Object.entries(requiredNamespaces)) {
    approvedNamespaces[key] = {
      accounts: [],
      methods: namespace.methods ?? [],
      events: namespace.events ?? [],
      chains: namespace.chains ?? [],
    };
  }

  return approvedNamespaces;
};

export interface BuildApprovedSessionNamespacesOptions {
  proposal: SessionProposal;
  activeChain?: StellarRpcChain;
  activeAccount?: string;
}

/**
 * Build WalletConnect approved namespaces for a Stellar session proposal.
 * Uses `buildApprovedNamespaces` when account + chain are available (production path).
 */
export const buildApprovedSessionNamespaces = (
  options: BuildApprovedSessionNamespacesOptions
): Record<string, unknown> => {
  const { proposal, activeChain, activeAccount } = options;
  const { requiredNamespaces } = proposal.params;

  if (!activeChain || !activeAccount) {
    return copyProposalNamespaces(requiredNamespaces);
  }

  return buildApprovedNamespaces({
    proposal: proposal.params as Parameters<typeof buildApprovedNamespaces>[0]['proposal'],
    supportedNamespaces: {
      stellar: {
        accounts: [activeAccount],
        chains: [activeChain],
        methods: [...STELLAR_NAMESPACE_METHODS],
        events: [...STELLAR_NAMESPACE_EVENTS],
      },
    },
  });
};
