import { useStore } from "../state/store";

describe("State Management", () => {
  it("should set wallet correctly", () => {
    const { setWallet } = useStore.getState();

    setWallet({ address: "abc", balance: 100 });

    const state = useStore.getState();
    expect(state.address).toBe("abc");
    expect(state.balance).toBe(100);
  });

  it("should login and logout", () => {
    const { login, logout } = useStore.getState();

    login("token123");
    expect(useStore.getState().isAuthenticated).toBe(true);

    logout();
    expect(useStore.getState().isAuthenticated).toBe(false);
  });

  it("should reset all state", () => {
    const store = useStore.getState();

    store.login("token");
    store.setWallet({ balance: 500 });

    store.resetAll();

    const state = useStore.getState();
    expect(state.balance).toBe(0);
    expect(state.isAuthenticated).toBe(false);
  });
});
