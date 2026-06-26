import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';

export interface AllowlistState {
  approvedSites: Record<string, Record<string, string[]>>;
  isApproved: (origin: string, accountId: string, network: string) => boolean;
  approve: (origin: string, accountId: string, network: string) => void;
  revoke: (origin: string, accountId: string, network: string) => void;
  getApprovedList: (accountId: string, network: string) => string[];
}

export const useAllowlistStore = create<AllowlistState>()(
  persist(
    (set, get) => ({
      approvedSites: {},
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

          return {
            approvedSites: {
              ...state.approvedSites,
              [accountId]: {
                ...accountSites,
                [network]: [...networkSites, origin],
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

          return {
            approvedSites: {
              ...state.approvedSites,
              [accountId]: {
                ...accountSites,
                [network]: networkSites.filter((site) => site !== origin),
              },
            },
          };
        });
      },
      getApprovedList: (accountId: string, network: string) => {
        const { approvedSites } = get();
        const accountSites = approvedSites[accountId] || {};
        return accountSites[network] || [];
      },
    }),
    {
      name: 'ancore_allowlist',
      storage: createJSONStorage(() => extensionStorage),
    }
  )
);
