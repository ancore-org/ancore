import { create } from "zustand";
import { createWalletSlice } from "./wallet.slice";
import { createSessionSlice } from "./session.slice";
import { createNetworkSlice } from "./network.slice";

export const useStore = create((set, get) => ({
  ...createWalletSlice(set, get),
  ...createSessionSlice(set, get),
  ...createNetworkSlice(set, get),

  resetAll: () => {
    get().resetWallet();
    get().logout();
    get().setNetwork("testnet");
  },
}));
