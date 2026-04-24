export type NetworkType = "mainnet" | "testnet";

export interface NetworkState {
  network: NetworkType;
  isOnline: boolean;
}

export interface NetworkActions {
  setNetwork: (network: NetworkType) => void;
  setOnlineStatus: (status: boolean) => void;
}
