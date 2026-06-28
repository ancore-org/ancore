import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';

export interface ConnectedSiteRecord {
  origin: string;
  accountId: string;
  network: string;
  connectedAt: number;
}

export interface AllowlistState {
  approvedSites: Record<string, Record<string, string[]>>;
  connectedSites: Record<string, Record<string, Record<string, ConnectedSiteRecord>>>;
  isApproved: (origin: string, accountId: string, network: string) => boolean;
  approve: (origin: string, accountId: string, network: string) => void;
  revoke: (origin: string, accountId: string, network: string) => void;
  revokeAll: (accountId: string, network: string) => void;
  getApprovedList: (accountId: string, network: string) => string[];
  getConnectedSites: (accountId: string, network: string) => ConnectedSiteRecord[];
}

export const useAllowlistStore = create<AllowlistState>()(
  persist(
    (set, get) => ({
      approvedSites: {},
      connectedSites: {},
      isApproved: (origin: string, accountId: string, network: string) => {
        const { approvedSites } = get();
        const accountSites = approvedSites[accountId] || {};
        const networkSites = accountSites[network] || [];
        return networkSites.includes(origin);
      },
      approve: (origin: string, accountId: string, network: string) => {
        set((state) => {
          const accountSites = state.approvedSites[accountId] || {};
          const networkSites = accountSites[network] || [];
          if (networkSites.includes(origin)) return state;

          const accountConnectedSites = state.connectedSites[accountId] || {};
          const networkConnectedSites = accountConnectedSites[network] || {};

          return {
            approvedSites: {
              ...state.approvedSites,
              [accountId]: {
                ...accountSites,
                [network]: [...networkSites, origin],
              },
            },
            connectedSites: {
              ...state.connectedSites,
              [accountId]: {
                ...accountConnectedSites,
                [network]: {
                  ...networkConnectedSites,
                  [origin]: {
                    origin,
                    accountId,
                    network,
                    connectedAt: Date.now(),
                  },
                },
              },
            },
          };
        });
      },
      revoke: (origin: string, accountId: string, network: string) => {
        set((state) => {
          const accountSites = state.approvedSites[accountId] || {};
          const networkSites = accountSites[network] || [];
          if (!networkSites.includes(origin)) return state;

          const nextApprovedSites = {
            ...state.approvedSites,
            [accountId]: {
              ...accountSites,
              [network]: networkSites.filter((site) => site !== origin),
            },
          };

          const nextConnectedSites = { ...state.connectedSites };
          const accountConnectedSites = nextConnectedSites[accountId] || {};
          const networkConnectedSites = accountConnectedSites[network] || {};
          const nextNetworkConnectedSites = { ...networkConnectedSites };
          delete nextNetworkConnectedSites[origin];

          if (Object.keys(nextNetworkConnectedSites).length === 0) {
            delete nextConnectedSites[accountId]?.[network];
          } else {
            nextConnectedSites[accountId] = {
              ...accountConnectedSites,
              [network]: nextNetworkConnectedSites,
            };
          }

          return {
            approvedSites: nextApprovedSites,
            connectedSites: nextConnectedSites,
          };
        });
      },
      revokeAll: (accountId: string, network: string) => {
        set((state) => {
          const accountSites = state.approvedSites[accountId] || {};
          if (!(network in accountSites)) return state;

          const nextApprovedSites = { ...state.approvedSites };
          const accountApprovedSites = { ...accountSites };
          delete accountApprovedSites[network];
          nextApprovedSites[accountId] = accountApprovedSites;

          const nextConnectedSites = { ...state.connectedSites };
          const accountConnectedSites = { ...(nextConnectedSites[accountId] || {}) };
          delete accountConnectedSites[network];
          if (Object.keys(accountConnectedSites).length === 0) {
            delete nextConnectedSites[accountId];
          } else {
            nextConnectedSites[accountId] = accountConnectedSites;
          }

          return {
            approvedSites: nextApprovedSites,
            connectedSites: nextConnectedSites,
          };
        });
      },
      getApprovedList: (accountId: string, network: string) => {
        const { approvedSites } = get();
        const accountSites = approvedSites[accountId] || {};
        return accountSites[network] || [];
      },
      getConnectedSites: (accountId: string, network: string) => {
        const { approvedSites, connectedSites } = get();
        const accountSites = approvedSites[accountId] || {};
        const networkSites = accountSites[network] || [];
        const metadataEntries = connectedSites[accountId]?.[network] || {};

        return networkSites
          .map((origin) => {
            const existingRecord = metadataEntries[origin];
            if (existingRecord) return existingRecord;
            return {
              origin,
              accountId,
              network,
              connectedAt: Date.now(),
            };
          })
          .sort((left, right) => left.origin.localeCompare(right.origin));
      },
    }),
    {
      name: 'ancore_allowlist',
      storage: createJSONStorage(() => extensionStorage),
    }
  )
);
