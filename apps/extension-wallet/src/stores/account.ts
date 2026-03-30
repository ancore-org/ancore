/**
 * Account Store (Zustand)
 *
 * Manages wallet accounts with persistence to chrome.storage via
 * the webextension-polyfill storage adapter.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';

export interface WalletAccount {
  id: string;
  address: string;
  label: string;
}

export interface AccountState {
  accounts: WalletAccount[];
  activeAccountId: string | null;

  setAccount: (account: WalletAccount) => void;
  setActiveAccount: (id: string) => void;
  removeAccount: (id: string) => void;
  clear: () => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      accounts: [],
      activeAccountId: null,

      setAccount: (account) =>
        set((state) => {
          const exists = state.accounts.some((a) => a.id === account.id);
          return {
            accounts: exists
              ? state.accounts.map((a) => (a.id === account.id ? account : a))
              : [...state.accounts, account],
            activeAccountId: state.activeAccountId ?? account.id,
          };
        }),

      setActiveAccount: (id) => set({ activeAccountId: id }),

      removeAccount: (id) =>
        set((state) => {
          const accounts = state.accounts.filter((a) => a.id !== id);
          const activeAccountId =
            state.activeAccountId === id ? (accounts[0]?.id ?? null) : state.activeAccountId;
          return { accounts, activeAccountId };
        }),

      clear: () => set({ accounts: [], activeAccountId: null }),
    }),
    {
      name: 'ancore-account',
      storage: createJSONStorage(() => extensionStorage),
    }
  )
);

/** Convenience selector — avoids re-renders when unrelated state changes. */
export function getAccountState() {
  return useAccountStore.getState();
}

/** @deprecated Use useAccountStore directly. Kept for router compatibility. */
export function initializeAccountStore() {
  // No-op: Zustand persist handles hydration automatically.
}
