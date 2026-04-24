import { WalletState, WalletActions } from "../types/wallet";

export const createWalletSlice = (set: any): WalletState & WalletActions => ({
  address: null,
  balance: 0,
  assets: {},

  setWallet: (data) =>
    set((state: WalletState) => ({
      ...state,
      ...data,
    })),

  resetWallet: () =>
    set({
      address: null,
      balance: 0,
      assets: {},
    }),
});
