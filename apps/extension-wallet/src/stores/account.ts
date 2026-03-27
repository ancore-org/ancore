import { useSyncExternalStore } from 'react';

export interface WalletAccount {
  id: string;
  address: string;
  label: string;
}

export interface AccountState {
  accounts: WalletAccount[];
  activeAccountId: string | null;
  hydrated: boolean;
}

type AccountUpdater = Partial<AccountState> | ((state: AccountState) => AccountState);

const listeners = new Set<() => void>();

let accountState: AccountState = {
  accounts: [],
  activeAccountId: null,
  hydrated: false,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getAccountState(): AccountState {
  return accountState;
}

export function setAccountState(next: AccountUpdater) {
  accountState =
    typeof next === 'function'
      ? next(accountState)
      : {
          ...accountState,
          ...next,
        };

  emitChange();
}

export function initializeAccountStore() {
  if (accountState.hydrated) {
    return;
  }

  setAccountState({
    hydrated: true,
    accounts: [
      {
        id: 'primary',
        label: 'Primary wallet',
        address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      },
    ],
    activeAccountId: 'primary',
  });
}

export function useAccountStore(): AccountState {
  return useSyncExternalStore(subscribe, getAccountState, getAccountState);
}
