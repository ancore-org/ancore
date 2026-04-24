import { NetworkState, NetworkActions } from "../types/network";

export const createNetworkSlice = (set: any): NetworkState & NetworkActions => ({
  network: "testnet",
  isOnline: true,

  setNetwork: (network) => set({ network }),
  setOnlineStatus: (status) => set({ isOnline: status }),
});
