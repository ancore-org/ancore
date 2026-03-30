import { describe, it, expect, beforeEach } from 'vitest';
import { useAccountStore } from '../account';

beforeEach(() => {
  useAccountStore.setState({ accounts: [], activeAccountId: null });
});

describe('useAccountStore', () => {
  it('starts empty', () => {
    const { accounts, activeAccountId } = useAccountStore.getState();
    expect(accounts).toHaveLength(0);
    expect(activeAccountId).toBeNull();
  });

  it('adds an account and sets it as active', () => {
    const { setAccount } = useAccountStore.getState();
    setAccount({ id: 'a1', address: 'GABC', label: 'Primary' });

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(1);
    expect(state.activeAccountId).toBe('a1');
  });

  it('updates an existing account', () => {
    const { setAccount } = useAccountStore.getState();
    setAccount({ id: 'a1', address: 'GABC', label: 'Primary' });
    setAccount({ id: 'a1', address: 'GABC', label: 'Updated' });

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(1);
    expect(state.accounts[0].label).toBe('Updated');
  });

  it('sets active account', () => {
    const { setAccount, setActiveAccount } = useAccountStore.getState();
    setAccount({ id: 'a1', address: 'GABC', label: 'Primary' });
    setAccount({ id: 'a2', address: 'GDEF', label: 'Secondary' });
    setActiveAccount('a2');

    expect(useAccountStore.getState().activeAccountId).toBe('a2');
  });

  it('removes an account and updates active', () => {
    const { setAccount, removeAccount } = useAccountStore.getState();
    setAccount({ id: 'a1', address: 'GABC', label: 'Primary' });
    setAccount({ id: 'a2', address: 'GDEF', label: 'Secondary' });
    removeAccount('a1');

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(1);
    expect(state.activeAccountId).toBe('a2');
  });

  it('clears all accounts', () => {
    const { setAccount, clear } = useAccountStore.getState();
    setAccount({ id: 'a1', address: 'GABC', label: 'Primary' });
    clear();

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(0);
    expect(state.activeAccountId).toBeNull();
  });
});
